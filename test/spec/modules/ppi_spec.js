import { expect } from 'chai';
import * as utils from 'src/utils.js';
import * as ppi from 'modules/ppi/index.js'
import { TransactionType } from 'modules/aup/consts.js'
import { makeSlot } from '../integration/faker/googletag.js';
import * as gptDest from 'modules/gptDestination.js';
import * as cacheDest from 'modules/cacheDestination.js';
import * as cacheSrc from 'modules/cacheSource.js';

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
          hbInventory: {
            type: 'slots',
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
          hbSource: 'auction',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // missing 'values.name'
        {
          hbInventory: {
            type: TransactionType.SLOT,
          },
          hbSource: 'auction',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // not valid source
        {
          hbInventory: {
            type: TransactionType.SLOT,
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
          hbSource: 'gpt',
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // not existing destination.tpye
        {
          hbInventory: {
            type: TransactionType.SLOT,
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
          hbSource: 'auction',
          hbDestination: {
          }
        },
        // not valid destination type
        {
          hbInventory: {
            type: TransactionType.DIV,
            values: {
              name: 'header-bid-tag-0',
            }
          },
          hbSource: 'auction',
          hbDestination: {
            type: 'gpts',
            values: { div: 'test-1' }
          }
        },
        // source and destination can't be cache at the same time
        {
          hbInventory: {
            type: TransactionType.DIV,
            values: {
              name: 'header-bid-tag-0',
            }
          },
          hbSource: 'cache',
          hbDestination: {
            type: 'cache',
          }
        },
        // sizes can't be string
        {
          hbInventory: {
            type: TransactionType.DIV,
            values: {
              name: 'header-bid-tag-0',
            }
          },
          hbSource: 'auction',
          sizes: '1x1',
          hbDestination: {
            type: 'gpt',
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
          hbInventory: {
            type: TransactionType.SLOT,
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
          hbSource: 'auction',
          sizes: [1, 1],
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // ppi should remove invalid '2'
        {
          hbInventory: {
            type: TransactionType.SLOT,
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
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

  // describe('request bids', () => {
  //   // clear everything
  //   while (aup.adUnitPatterns.length) aup.adUnitPatterns.pop();
  //   window.googletag.pubads().setSlots([]);

  //   let adUnitPatterns = [
  //     {
  //       slotPattern: '^.*header-bid-tag-0$',
  //       divPattern: '',
  //       code: 'pattern-1',
  //       bids: [
  //         {
  //           bidder: 'appnexus',
  //           params: {
  //             placementId: 13144370,
  //           },
  //         },
  //         {
  //           bidder: 'rubicon',
  //           params: {
  //             accountId: '1001',
  //             siteId: '113932',
  //             zoneId: '535510',
  //           }
  //         }],
  //       mediaTypes: {
  //         banner: {
  //           sizes: [[300, 250], [300, 600]]
  //         },
  //       },
  //     }, {
  //       slotPattern: '/19968336/header-bid-tag-1',
  //       divPattern: '^test-.$',
  //       code: 'pattern-2',
  //       bids: [
  //         {
  //           bidder: 'appnexus',
  //           params: {
  //             placementId: 13144370,
  //           },
  //         },
  //         {
  //           bidder: 'rubicon',
  //           params: {
  //             accountId: '1001',
  //             siteId: '113932',
  //             zoneId: '535510',
  //           }
  //         }],
  //       mediaTypes: {
  //         banner: {
  //           sizes: [[300, 250], [300, 600]]
  //         },
  //       },
  //     }
  //   ];

  //   let transactionObjects = [
  //     {
  //       value: 'test-1',
  //       type: 'div',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'page',
  //         values: { div: 'test-1' }
  //       }
  //     },
  //     {
  //       value: 'cannot match',
  //       type: 'div',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'page',
  //         values: { div: 'test-2' }
  //       }
  //     },
  //     {
  //       value: '/19968336/header-bid-tag-0',
  //       type: 'slot',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'page',
  //         values: { div: 'test-5' }
  //       }
  //     },
  //   ];
  //   aup.addAdUnitPatterns(adUnitPatterns);

  //   for (let i = 1; i <= 4; i++) {
  //     let newDiv = document.createElement('div');
  //     newDiv.id = 'test-' + i;

  //     document.body.appendChild(newDiv);
  //   }

  //   let sandbox;
  //   beforeEach(() => {
  //     sandbox = sinon.sandbox.create();
  //   });

  //   afterEach(() => {
  //     sandbox.restore();
  //   });
  //   it('should request bids from cache to page', () => {
  //     sandbox.stub($$PREBID_GLOBAL$$, 'getHighestCpmBids').callsFake((key) => {
  //       if (key === 'pattern-1') return [{ width: 300, height: 250 }];
  //       return [];
  //     });

  //     let res = ppi.requestBids(transactionObjects);
  //     expect(res[0].adUnit.code).to.equal('pattern-1');
  //     expect(res[1].adUnit).to.be.a('undefined');
  //     expect(res[2].adUnit.code).to.equal('pattern-2');
  //   });

  //   it('should request bids from cache to callback', () => {
  //     sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((key) => {
  //       if (key === 'pattern-1') {
  //         return [{
  //           width: 300,
  //           height: 250,
  //           status: 'available',
  //           responseTimestamp: new Date().getTime(),
  //           ttl: 60,
  //           cpm: 1.23,
  //         }];
  //       }
  //       return [];
  //     });
  //     let tos = utils.deepClone(transactionObjects);
  //     tos[0].hbDestination = {
  //       type: 'callback',
  //       values: {
  //         callback: (bids) => {
  //           expect(bids.length).to.equal(1);
  //           expect(bids[0].cpm).to.equal(1.23);
  //         }
  //       }
  //     };
  //     tos[1].hbDestination = {
  //       type: 'callback',
  //       values: {
  //         callback: (bids) => {
  //           expect(bids).to.be.a('undefined');
  //         }
  //       }
  //     };
  //     tos[2].hbDestination = {
  //       type: 'callback',
  //       values: {
  //         callback: 'this should be function, not a string'
  //       }
  //     };

  //     ppi.requestBids(tos);
  //   });

  //   it('should cache new bids', () => {
  //     sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
  //       bidsBackHandler();
  //     });
  //     let tos = utils.deepClone(transactionObjects);
  //     tos.forEach(to => {
  //       to.hbSource = 'auction';
  //       to.hbDestination = {
  //         type: 'cache',
  //       }
  //     })

  //     let res = ppi.requestBids(tos);
  //     expect(res[0].adUnit.code).to.equal('pattern-1');
  //     expect(res[1].adUnit).to.be.a('undefined');
  //     expect(res[2].adUnit.code).to.equal('pattern-2');
  //   });

  //   it('should refresh gpt slots from cache', () => {
  //     while (aup.adUnitPatterns.length) aup.adUnitPatterns.pop();
  //     aup.addAdUnitPatterns(adUnitPatterns);
  //     window.googletag.pubads().setSlots([]);
  //     let gptSlotSizes = [[300, 250], [300, 600]];
  //     let gptSlots = [
  //       makeGPTSlot('/19968336/header-bid-tag-0', 'test-1', gptSlotSizes),
  //       makeGPTSlot('/19968336/no-match', 'no-match', gptSlotSizes),
  //     ];
  //     let _pubads = window.googletag.pubads();
  //     _pubads.refresh = (slots) => {
  //       expect(slots).to.deep.equal(gptSlots);
  //     };
  //     window.googletag.pubads = () => { return _pubads };
  //     window.googletag.cmd = window.googletag.cmd || [];
  //     window.googletag.cmd.push = function (command) {
  //       command.call();
  //     };
  //     let tos = [{
  //       value: gptSlots[0],
  //       type: 'slotObject',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'gpt',
  //         values: { div: 'test-1' }
  //       },
  //     },
  //     {
  //       value: gptSlots[1],
  //       type: 'slotObject',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'gpt',
  //       }
  //     }];
  //     let res = ppi.requestBids(tos);
  //     expect(res[0].adUnit.code).to.equal('pattern-1');
  //     expect(res[1].adUnit).to.be.a('undefined');
  //   });

  //   it('should create and refresh gpt slots from cache', () => {
  //     while (aup.adUnitPatterns.length) aup.adUnitPatterns.pop();
  //     aup.addAdUnitPatterns(adUnitPatterns);
  //     window.googletag.pubads().setSlots([]);
  //     let _pubads = window.googletag.pubads();
  //     _pubads.refresh = (slots) => {
  //     };

  //     window.googletag.defineSlot = (adUnitPath, sizes, divId) => {
  //       let slot = makeGPTSlot(adUnitPath, divId, sizes);
  //       slot.addService = () => { };
  //       return slot;
  //     }
  //     window.googletag.display = () => { };
  //     window.googletag.pubads = () => { return _pubads };
  //     window.googletag.cmd = window.googletag.cmd || [];
  //     window.googletag.cmd.push = function (command) {
  //       command.call();
  //     };
  //     let tos = [{
  //       value: 'test-1',
  //       type: 'div',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'gpt',
  //       }
  //     },
  //     {
  //       value: '/19968336/header-bid-tag-0',
  //       type: 'slot',
  //       hbSource: 'cache',
  //       hbDestination: {
  //         type: 'gpt',
  //         values: { div: 'test-2' }
  //       }
  //     }];

  //     let res = ppi.requestBids(tos);
  //     expect(res[0].adUnit.code).to.equal('pattern-2');
  //     expect(res[1].adUnit.code).to.equal('pattern-1');
  //   });
  // });
});
