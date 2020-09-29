import { expect, should } from 'chai';
import * as utils from 'src/utils.js';
import * as ppi from 'modules/ppi/index.js'
import { makeSlot } from '../integration/faker/googletag.js';

function makeGPTSlot(adUnitPath, divId, sizes = []) {
  let gptSlot = makeSlot({ code: adUnitPath, divId: divId });
  let sizeObj = [];
  sizes.forEach(size => {
    sizeObj.push({
      size,
      getWidth: () => {
        return size[0];
      },
      getHeight: () => {
        return size[1];
      }
    })
  });
  gptSlot.getSizes = () => {
    return sizeObj;
  }
  return gptSlot;
}

describe('ppiTest', () => {
  describe('validate transaction objects', () => {
    it('should not accept invalid transaction objects', () => {
      let invalidTOs = [
        // not valid 'type'
        {
          value: '/19968336/header-bid-tag-0',
          type: 'slots',
          hbSource: 'auction',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // missing 'value'
        {
          type: 'slot',
          hbSource: 'auction',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // not valid source
        {
          value: '/19968336/header-bid-tag-0',
          type: 'slot',
          hbSource: 'gpt',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // not existing destination.tpye
        {
          value: '/19968336/header-bid-tag-0',
          type: 'slot',
          hbSource: 'auction',
          hbDestination: {
          }
        },
        // not valid destination type
        {
          value: 'header-bid-tag-0',
          type: 'div',
          hbSource: 'auction',
          hbDestination: {
            type: 'gpts',
            values: { div: 'test-1' }
          }
        },
        // source and destination can't be cache at the same time
        {
          type: 'autoSlots',
          hbSource: 'cache',
          hbDestination: {
            type: 'cache',
          }
        },
        // sizes can't be string
        {
          value: 'header-bid-tag-0',
          type: 'div',
          hbSource: 'auction',
          sizes: '1x1',
          hbDestination: {
            type: 'cache',
          }
        },
      ];

      let result = ppi.validateTransactionObjects(invalidTOs);
      expect(result.invalid.length).to.equal(invalidTOs.length);
      for (let i = 0; i < result.length; i++) {
        expect(result.invalid[i].type).to.equal(invalidTOs[i].type);
        expect(result.invalid[i].error).to.be.a('string');
      }
    });

    it('should fix invalid sizes object', () => {
      let validTOs = [
        // convert array to matrix
        {
          value: '/19968336/header-bid-tag-0',
          type: 'slot',
          hbSource: 'auction',
          sizes: [1, 1],
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // ppi should remove invalid '2'
        {
          value: '/19968336/header-bid-tag-0',
          type: 'slot',
          hbSource: 'auction',
          sizes: [[1, 1], 2],
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        }
      ];

      let result = ppi.validateTransactionObjects(validTOs);
      expect(result.valid.length).to.equal(validTOs.length);
      for (let i = 0; i < result.length; i++) {
        expect(result.valid[i].size).to.deep.equal([[1, 1]]);
        expect(result.valid[i].error).to.be.a('undefined');
      }
    });
  });

  describe('autoSlot transformation', () => {
    let tos = [
      {
        type: 'autoSlots',
        hbSource: 'auction',
        hbDestination: {
          type: 'cache',
        }
      },
      {
        type: 'autoSlots',
        hbSource: 'cache',
        hbDestination: {
          type: 'gpt',
        }
      },
    ];
    const initialSlots = window.googletag.pubads().getSlots();
    it('should not create any TOs when no gpt slot is created', () => {
      window.googletag.pubads().setSlots([]);
      let transformed = ppi.transformAutoSlots(tos);
      expect(transformed.length).to.equal(0);
    });

    it('should transform autoSlot into array of slot objects', () => {
      window.googletag.pubads().setSlots([]);
      const testSlots = [
        makeSlot({ code: 'slotCode1', divId: 'div1' }),
        makeSlot({ code: 'slotCode2', divId: 'div2' }),
        makeSlot({ code: 'slotCode3', divId: 'div3' })
      ];
      let transformed = ppi.transformAutoSlots(tos);
      expect(transformed.length).to.equal(testSlots.length * tos.length);
      for (let i = 0; i < tos.length; i++) {
        for (let j = 0; j < testSlots.length; j++) {
          let transformedTO = transformed[i * testSlots.length + j];

          // source and destination should be copied from original TO
          expect(transformedTO.hbSource).to.equal(tos[i].hbSource);
          expect(transformedTO.hbDestination.type).to.equal(tos[i].hbDestination.type);

          expect(transformedTO.value.getAdUnitPath()).to.equal(testSlots[j].getAdUnitPath());
          expect(transformedTO.value.getSlotElementId()).to.equal(testSlots[j].getSlotElementId());
        }
      }
    });
    window.googletag.pubads().setSlots(initialSlots);
  });

  describe('add adUnitPattern', () => {
    it('should validate aup before adding', () => {
      while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
      let validAUPs = [
        {
          slotPattern: '^.*header-bid-tag-0$',
          divPattern: 'test-*',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[300, 250], [300, 600]]
            },
          },
        },
        {
          // convert size array to matrix
          slotPattern: '',
          divPattern: 'test-*',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [1, 1]
            },
          },
        },
        {
          // ppi should remove invalid '2' from array sizes
          slotPattern: '^.*header-bid-tag-0$',
          divPattern: '',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[1, 1], 2]
            },
          },
        },
      ];
      let invalidAUPs = [
        {
          // can't have empty strings for both slotPattern and divPattern
          slotPattern: '',
          divPattern: '',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[300, 250], [300, 600]]
            },
          },
        },
        {
          // size can't be boolean
          slotPattern: '^.*header-bid-tag-0$',
          divPattern: '',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: true
            },
          },
        },
      ];

      ppi.addAdUnitPatterns(invalidAUPs);
      expect(ppi.adUnitPatterns.length).to.equal(0);

      ppi.addAdUnitPatterns(validAUPs);
      expect(ppi.adUnitPatterns.length).to.equal(validAUPs.length);
      for (let i = 1; i < ppi.adUnitPatterns.length; i++) {
        expect(ppi.adUnitPatterns[i].mediaTypes.banner.sizes).to.deep.equal([[1, 1]]);
      }
    });

    describe('add adUnitPattern', () => {
      let adUnitPatterns = [
        {
          slotPattern: '^.*header-bid-tag-.*$',
          divPattern: 'test-*',
          code: 'pattern-1',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[1, 1]]
            },
          },
        },
        {
          slotPattern: '^.*header-bid-tag-.*$',
          divPattern: 'test-*',
          code: 'pattern-2',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[1, 1]]
            },
          },
        },
        {
          slotPattern: '',
          divPattern: 'test-*',
          bids: [
            {
              bidder: 'rubicon',
              params: {
                accountId: '1001',
                siteId: '113932',
                zoneId: '535510',
              }
            }
          ],
          mediaTypes: {
            banner: {
              sizes: [[1, 1]]
            },
          },
        },
      ];
      it('should match TO against AUP', () => {
        let tos = [
          {
            value: 'test-1',
            type: 'div',
            hbSource: 'auction',
            hbDestination: {
              type: 'gpt',
              values: { div: 'test-1' }
            }
          },
          {
            value: '/19968336/header-bid-tag-0',
            type: 'slot',
            hbSource: 'auction',
            sizes: [[1, 1]],
            hbDestination: {
              type: 'gpt',
              values: { div: 'test-2' }
            }
          },
          {
            value: '/19968336/header-bid-tag-0',
            type: 'slot',
            hbSource: 'auction',
            hbDestination: {
              type: 'gpt',
              values: { div: 'test-3' }
            },
          },
        ];
        while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
        expect(ppi.adUnitPatterns.length).to.equal(0);
        ppi.addAdUnitPatterns(adUnitPatterns);
        let result = ppi.getTOAUPPair(tos, ppi.adUnitPatterns);
        expect(tos.length).to.equal(result.length);
        for (let i = 0; i < result.length; i++) {
          expect(tos[i]).to.equal(result[i].transactionObject);
        }
        for (let i = 0; i < result.length - 1; i++) {
          expect(adUnitPatterns[i].value).to.equal(result[i].adUnitPattern.value);
          expect(adUnitPatterns[i].type).to.equal(result[i].adUnitPattern.type);
          expect(adUnitPatterns[i].hbSource).to.equal(result[i].adUnitPattern.hbSource);
          expect(adUnitPatterns[i].hbDestination).to.deep.equal(result[i].adUnitPattern.hbDestination);
        }
        expect(result[2].adUnitPattern).to.be.a('undefined');
      });

      it('should match gpt slot', () => {
        while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
        window.googletag.pubads().setSlots([]);

        let gptSlotSizes = [[1, 1], [2, 2]];
        let gptSlots = [
          makeGPTSlot('/19968336/header-bid-tag-0', 'test-1', gptSlotSizes),
          makeGPTSlot('/19968336/header-bid-tag-1', 'test-2', gptSlotSizes),
        ];

        let tos = [
          {
            value: gptSlots[0],
            type: 'slotObject',
            hbSource: 'auction',
            hbDestination: {
              type: 'gpt',
              values: { div: 'test-1' }
            }
          },
          {
            value: gptSlots[1],
            type: 'slotObject',
            hbSource: 'auction',
            sizes: [[1, 1]],
            hbDestination: {
              type: 'cache',
              values: { div: 'test-2' }
            }
          },
        ];

        ppi.addAdUnitPatterns(adUnitPatterns);
        let result = ppi.getTOAUPPair(tos, ppi.adUnitPatterns);
        expect(tos.length).to.equal(result.length);
        for (let i = 0; i < result.length - 1; i++) {
          expect(adUnitPatterns[i].value).to.equal(result[i].adUnitPattern.value);
          expect(adUnitPatterns[i].type).to.equal(result[i].adUnitPattern.type);
          expect(adUnitPatterns[i].hbSource).to.equal(result[i].adUnitPattern.hbSource);
          expect(adUnitPatterns[i].hbDestination).to.deep.equal(result[i].adUnitPattern.hbDestination);
        }
      });
    });
  });

  describe('create adUnit', () => {
    it('should create pbjs adUnit from AUP', () => {
      let sizes = [[1, 1], [1, 2], [2, 1], [2, 2]];
      let aup = {
        slotPattern: '^.*header-bid-tag-.*$',
        divPattern: 'test-*',
        bids: [
          {
            bidder: 'rubicon',
            params: {
              accountId: '1001',
              siteId: '113932',
              zoneId: '535510',
            }
          }
        ],
      };
      let to = {
        type: 'slot',
        value: '/19968336/header-bid-tag-0',
        sizes: sizes,
      };

      let adUnit = ppi.createAdUnit(aup, to);
      expect(aup.bids).to.deep.equal(adUnit.bids);
      expect(sizes).to.deep.equal(utils.deepAccess(adUnit, 'mediaTypes.banner.sizes'));
      expect(adUnit.slotPattern).to.be.a('undefined');
      expect(adUnit.divPattern).to.be.a('undefined');
      expect(adUnit.code).to.be.a('string');

      // now add code to aup
      aup.code = 'pattern-1';
      adUnit = ppi.createAdUnit(aup, to);
      expect(adUnit.code).to.equal('pattern-1');

      // now add sizes to aup
      utils.deepSetValue(aup, 'mediaTypes.banner.sizes', sizes);
      to.sizes = [];
      adUnit = ppi.createAdUnit(aup, to);
      expect(adUnit.mediaTypes.banner.sizes).to.deep.equal(sizes);

      // now do the size intersection between aup sizes and limit sizes
      to.sizes = [[2, 2], [1, 1], [3, 3], [4, 4]];
      adUnit = ppi.createAdUnit(aup, to);
      expect(adUnit.mediaTypes.banner.sizes).to.deep.equal([[2, 2], [1, 1]]);
    });
  });

  describe('request bids', () => {
    // clear everything
    while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
    window.googletag.pubads().setSlots([]);

    let adUnitPatterns = [
      {
        slotPattern: '^.*header-bid-tag-0$',
        divPattern: '',
        code: 'pattern-1',
        bids: [
          {
            bidder: 'appnexus',
            params: {
              placementId: 13144370,
            },
          },
          {
            bidder: 'rubicon',
            params: {
              accountId: '1001',
              siteId: '113932',
              zoneId: '535510',
            }
          }],
        mediaTypes: {
          banner: {
            sizes: [[300, 250], [300, 600]]
          },
        },
      }, {
        slotPattern: '/19968336/header-bid-tag-1',
        divPattern: '^test-.$',
        code: 'pattern-2',
        bids: [
          {
            bidder: 'appnexus',
            params: {
              placementId: 13144370,
            },
          },
          {
            bidder: 'rubicon',
            params: {
              accountId: '1001',
              siteId: '113932',
              zoneId: '535510',
            }
          }],
        mediaTypes: {
          banner: {
            sizes: [[300, 250], [300, 600]]
          },
        },
      }
    ];

    let transactionObjects = [
      {
        value: 'test-1',
        type: 'div',
        hbSource: 'cache',
        hbDestination: {
          type: 'page',
          values: { div: 'test-1' }
        }
      },
      {
        value: 'cannot match',
        type: 'div',
        hbSource: 'cache',
        hbDestination: {
          type: 'page',
          values: { div: 'test-2' }
        }
      },
      {
        value: '/19968336/header-bid-tag-0',
        type: 'slot',
        hbSource: 'cache',
        hbDestination: {
          type: 'page',
          values: { div: 'test-5' }
        }
      },
    ];
    ppi.addAdUnitPatterns(adUnitPatterns);

    for (let i = 1; i <= 4; i++) {
      let newDiv = document.createElement('div');
      newDiv.id = 'test-' + i;

      document.body.appendChild(newDiv);
    }

    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
      sandbox.restore();
    });
    it('should request bids from cache to page', () => {
      sandbox.stub($$PREBID_GLOBAL$$, 'getHighestCpmBids').callsFake((key) => {
        if (key === 'pattern-1') return [{ width: 300, height: 250 }];
        return [];
      });

      let res = ppi.requestBids(transactionObjects);
      expect(res[0].match.status).to.equal(true);
      expect(res[0].match.aup.code).to.equal('pattern-1');
      expect(res[1].match.status).to.equal(false);
      expect(res[2].match.status).to.equal(true);
      expect(res[2].match.aup.code).to.equal('pattern-2');
    });

    it('should request bids from cache to callback', () => {
      sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((key) => {
        if (key === 'pattern-1') {
          return [{
            width: 300,
            height: 250,
            status: 'available',
            responseTimestamp: new Date().getTime(),
            ttl: 60,
            cpm: 1.23,
          }];
        }
        return [];
      });
      let tos = utils.deepClone(transactionObjects);
      tos[0].hbDestination = {
        type: 'callback',
        values: {
          callback: (bids) => {
            expect(bids.length).to.equal(1);
            expect(bids[0].cpm).to.equal(1.23);
          }
        }
      };
      tos[1].hbDestination = {
        type: 'callback',
        values: {
          callback: (bids) => {
            expect(bids).to.be.a('undefined');
          }
        }
      };
      tos[2].hbDestination = {
        type: 'callback',
        values: {
          callback: 'this should be function, not a string'
        }
      };

      ppi.requestBids(tos);
    });

    it('should cache new bids', () => {
      sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
        bidsBackHandler();
      });
      let tos = utils.deepClone(transactionObjects);
      tos.forEach(to => {
        to.hbSource = 'auction';
        to.hbDestination = {
          type: 'cache',
        }
      })

      let res = ppi.requestBids(tos);
      expect(res[0].match.status).to.equal(true);
      expect(res[0].match.aup.code).to.equal('pattern-1');
      expect(res[1].match.status).to.equal(false);
      expect(res[2].match.status).to.equal(true);
      expect(res[2].match.aup.code).to.equal('pattern-2');
    });

    it('should refresh gpt slots from cache', () => {
      while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
      ppi.addAdUnitPatterns(adUnitPatterns);
      window.googletag.pubads().setSlots([]);
      let gptSlotSizes = [[300, 250], [300, 600]];
      let gptSlots = [
        makeGPTSlot('/19968336/header-bid-tag-0', 'test-1', gptSlotSizes),
        makeGPTSlot('/19968336/no-match', 'no-match', gptSlotSizes),
      ];
      let _pubads = window.googletag.pubads();
      _pubads.refresh = (slots) => {
        expect(slots).to.deep.equal(gptSlots);
      };
      window.googletag.pubads = () => { return _pubads };
      window.googletag.cmd = window.googletag.cmd || [];
      window.googletag.cmd.push = function (command) {
        command.call();
      };
      let tos = [{
        value: gptSlots[0],
        type: 'slotObject',
        hbSource: 'cache',
        hbDestination: {
          type: 'gpt',
          values: { div: 'test-1' }
        },
      },
      {
        value: gptSlots[1],
        type: 'slotObject',
        hbSource: 'cache',
        hbDestination: {
          type: 'gpt',
        }
      }];
      let res = ppi.requestBids(tos);
      expect(res[0].match.status).to.equal(true);
      expect(res[0].match.aup.code).to.equal('pattern-1');
      expect(res[1].match.status).to.equal(false);
    });

    it('should create and refresh gpt slots from cache', () => {
      while (ppi.adUnitPatterns.length) ppi.adUnitPatterns.pop();
      ppi.addAdUnitPatterns(adUnitPatterns);
      window.googletag.pubads().setSlots([]);
      let _pubads = window.googletag.pubads();
      _pubads.refresh = (slots) => {
      };

      window.googletag.defineSlot = (adUnitPath, sizes, divId) => {
        let slot = makeGPTSlot(adUnitPath, divId, sizes);
        slot.addService = () => { };
        return slot;
      }
      window.googletag.display = () => { };
      window.googletag.pubads = () => { return _pubads };
      window.googletag.cmd = window.googletag.cmd || [];
      window.googletag.cmd.push = function (command) {
        command.call();
      };
      let tos = [{
        value: 'test-1',
        type: 'div',
        hbSource: 'cache',
        hbDestination: {
          type: 'gpt',
        }
      },
      {
        value: '/19968336/header-bid-tag-0',
        type: 'slot',
        hbSource: 'cache',
        hbDestination: {
          type: 'gpt',
          values: { div: 'test-2' }
        }
      }];

      let res = ppi.requestBids(tos);
      expect(res[0].match.status).to.equal(true);
      expect(res[0].match.aup.code).to.equal('pattern-2');
      expect(res[1].match.status).to.equal(true);
      expect(res[1].match.aup.code).to.equal('pattern-1');
    });
  });
});
