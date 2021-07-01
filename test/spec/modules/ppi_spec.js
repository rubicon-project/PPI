import { expect } from 'chai';
import * as utils from 'src/utils.js';
import * as ppi from 'modules/ppi/index.js'
import * as aup from 'modules/ppi/hbInventory/aup/aup.js'
import { TransactionType } from 'modules/ppi/hbInventory/aup/consts.js'

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
          hbSource: {
            type: 'auction',
          },
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
          hbSource: {
            type: 'auction',
          },
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
          hbSource: {
            type: 'gpt',
          },
          hbDestination: {
            type: 'gpt',
            values: { div: 'test-1' }
          }
        },
        // not existing destination.type
        {
          hbInventory: {
            type: TransactionType.SLOT,
            values: {
              name: '/19968336/header-bid-tag-0',
            }
          },
          hbSource: {
            type: 'auction',
          },
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
          hbSource: {
            type: 'auction',
          },
          hbDestination: {
            type: 'gpts',
            values: { div: 'test-1' }
          }
        },
        // sizes can't be string
        {
          hbInventory: {
            type: TransactionType.DIV,
            values: {
              name: 'header-bid-tag-0',
            },
            sizes: '1x1'
          },
          hbSource: {
            type: 'auction',
          },
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
          hbSource: {
            type: 'auction',
          },
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
          hbSource: {
            type: 'auction',
          },
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

  describe('request bids', () => {
    // clear everything
    while (aup.adUnitPatterns.length) aup.adUnitPatterns.pop();

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
        hbInventory: {
          type: TransactionType.DIV,
          values: {
            name: 'test-1',
          }
        },
        hbSource: {
          type: 'cache',
        },
        hbDestination: {
          type: 'page',
          values: { div: 'test-1' }
        }
      },
      {
        hbInventory: {
          type: TransactionType.DIV,
          values: {
            name: 'cannot match',
          }
        },
        hbSource: {
          type: 'cache',
        },
        hbDestination: {
          type: 'page',
          values: { div: 'test-2' }
        }
      },
      {
        hbInventory: {
          type: TransactionType.SLOT,
          values: {
            name: '/19968336/header-bid-tag-0',
          }
        },
        hbSource: {
          type: 'cache',
        },
        hbDestination: {
          type: 'page',
          values: { div: 'test-5' }
        }
      },
    ];
    aup.addAdUnitPatterns(adUnitPatterns);

    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should cache new bids', () => {
      let newAuctionHeld = false;
      sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
        bidsBackHandler();
        newAuctionHeld = true;
      });
      let tos = utils.deepClone(transactionObjects);
      tos.forEach(to => {
        to.hbSource.type = 'auction';
        to.hbDestination = {
          type: 'cache',
        }
      })

      let res = ppi.requestBids(tos);
      expect(res[0].adUnit.code).to.equal('pattern-1');
      expect(res[1].adUnit).to.be.a('undefined');
      expect(res[2].adUnit.code).to.equal('pattern-2');
      expect(newAuctionHeld).to.equal(true);
    });
  });
});
