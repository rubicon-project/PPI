import { expect } from 'chai';
import { hbDestination } from 'modules/ppi/hbDestination/hbDestination.js';
import * as utils from 'src/utils.js';
import { makeSlot } from '../integration/faker/googletag.js';
import { targeting } from 'src/targeting.js';

function makeGPTSlot(adUnitPath, divId, sizes = []) {
  let gptSlot = makeSlot({ code: adUnitPath, divId: divId });
  let sizeObj = [];
  sizes.forEach(size => {
    if (!Array.isArray(size)) {
      sizeObj.push(size);
      return;
    }

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

describe('test ppi hbDestination submodule', () => {
  let matches = [
    // adUnit was not matched
    {
      transactionObject: {},
      adUnit: undefined,
    },
    // adUnit was matched, result should be rendered in 'test-1' div
    {
      transactionObject: {
        hbDestination: {
          type: 'page',
          values: { div: 'test-1' }
        }
      },
      adUnit: {
        code: 'pattern-1'
      }
    },
    // adUnit was matched, but bid not found
    {
      transactionObject: {
        hbDestination: {
          type: 'page',
          values: { div: 'test-2' }
        }
      },
      adUnit: {
        code: 'pattern-2',
      }
    },
    // adUnit was matched, but div not found
    {
      transactionObject: {
        hbDestination: {
          type: 'page',
          values: { div: 'test-5' }
        }
      },
      adUnit: {
        code: 'pattern-5',
      }
    },
  ];

  for (let i = 1; i <= 4; i++) {
    let newDiv = document.createElement('div');
    newDiv.id = 'test-' + i;

    document.body.appendChild(newDiv);
  }

  const bidAdId = 'test-1';
  const adUnitBids = {
    'pattern-1': [{
      width: 300,
      height: 250,
      adId: bidAdId,
      status: 'available',
      responseTimestamp: new Date().getTime(),
      ttl: 600,
      cpm: 1.69,
    }],
    // expired bid
    'pattern-3': [{
      width: 300,
      height: 250,
      status: 'available',
      responseTimestamp: 1,
    }]
  }

  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('page destination should process result', () => {
    sandbox.stub($$PREBID_GLOBAL$$, 'getHighestCpmBids').callsFake((key) => {
      return adUnitBids[key] || [];
    });

    let renderedAds = 0;
    sandbox.stub($$PREBID_GLOBAL$$, 'renderAd').callsFake((document, adId) => {
      renderedAds++;
      expect(adId).to.equal(bidAdId);
    });

    hbDestination['page'].send(matches);

    let test1 = document.getElementById('test-1');
    expect(test1.childNodes.length).to.equal(1);
    let test2 = document.getElementById('test-2');
    expect(test2.childNodes.length).to.equal(0);

    expect(renderedAds).to.equal(1);
  });

  it('callback destination should process result', () => {
    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((key) => {
      return { bids: adUnitBids[key] || [] };
    });

    let match = utils.deepClone(matches);
    match[0].transactionObject.hbDestination = {
      type: 'callback',
      values: {
        callback: (matchObj, bids) => {
          expect(matchObj).to.equal(match[0]);
          expect(bids).to.be.a('undefined');
        }
      }
    };
    match[1].transactionObject.hbDestination = {
      type: 'callback',
      values: {
        callback: (matchObj, bids) => {
          expect(matchObj).to.equal(match[1]);
          expect(bids.length).to.equal(1);
          expect(bids[0].cpm).to.equal(1.69);
        }
      }
    };
    match[2].transactionObject.hbDestination = {
      type: 'callback',
      values: {
        callback: (matchObj, bids) => {
          expect(matchObj).to.equal(match[2]);
          expect(bids).to.deep.equal([]);
        }
      }
    };
    match[3].transactionObject.hbDestination = {
      type: 'callback',
      values: {
        callback: 'this should be function, not a string'
      }
    };

    hbDestination['callback'].send(match);
  });

  it('gpt destination should process result with existing slots', () => {
    let adUnitTargeting = {
      'pattern-1': {
        hb_source: 'client',
        hb_pb: '1.69',
      }
    };

    window.googletag.pubads().setSlots([]);
    let gptSlotSizes = [[300, 250], [300, 600]];
    let gptSlots = [
      makeGPTSlot('/19968336/header-bid-tag-0', 'test-1', gptSlotSizes),
      makeGPTSlot('/19968336/no-match', 'no-match', gptSlotSizes),
    ];

    sandbox.stub(targeting, 'getAllTargeting').callsFake((adUnitCodes) => {
      let result = {};
      adUnitCodes.forEach(code => {
        result[code] = adUnitTargeting[code] || {};
      });
      return result;
    });
    let _pubads = window.googletag.pubads();
    _pubads.refresh = (slots) => {
      expect(slots.length).to.equal(gptSlots.length);
    };
    window.googletag.pubads = () => { return _pubads };
    window.googletag.cmd = window.googletag.cmd || [];
    window.googletag.cmd.push = (command) => {
      command.call();
    };

    let customTargeting = { color: 'blue', interests: ['sports', 'music', 'movies'] };
    let matches = [{
      transactionObject: {
        hbDestination: {
          type: 'gpt',
          values: {
            div: 'test-1',
            targeting: customTargeting,
          }
        },
      },
      adUnit: {
        code: 'pattern-1',
        mediaTypes: {
          banner: {
            sizes: [[300, 250], [300, 600]]
          },
        },
      },
    },
    {
      transactionObject: {
        hbDestination: {
          type: 'gpt',
          values: {
            div: 'no-match',
          }
        },
      }
    }];

    hbDestination['gpt'].send(matches);
    let slot1Targeting = gptSlots[0].getTargeting();
    let pbjsTargetingKeys = Object.keys(adUnitTargeting['pattern-1']).length;
    let customTargetingKeys = Object.keys(customTargeting).length;
    expect(slot1Targeting.length).to.equal(pbjsTargetingKeys + customTargetingKeys);
  });

  it('gpt destination should process result without existing slots', () => {
    window.googletag.pubads().setSlots([]);
    let _pubads = window.googletag.pubads();
    let slotsRefreshed = false;
    _pubads.refresh = (slots) => {
      slotsRefreshed = true;
    };

    window.googletag.defineSlot = (adUnitPath, sizes, divId) => {
      let slot = makeGPTSlot(adUnitPath, divId, sizes);
      slot.addService = () => { };
      return slot;
    }
    window.googletag.display = () => { };
    window.googletag.pubads = () => { return _pubads };
    window.googletag.cmd = window.googletag.cmd || [];
    window.googletag.cmd.push = (command) => {
      command.call();
    };
    let sizesWithFluid = [[300, 250], [300, 600], 'fluid'];
    let matches = [{
      transactionObject: {
        hbInventory: {
          sizes: sizesWithFluid,
        },
        divId: 'test-1',
        slotName: '/19968336/header-bid-tag-0',
        hbDestination: {
          type: 'gpt',
        }
      },
      adUnit: {
        code: 'pattern-1',
      },
    },
    {
      transactionObject: {
        slotName: '/19968336/header-bid-tag-1',
        hbDestination: {
          type: 'gpt',
          values: { div: 'test-2' }
        }
      },
      adUnit: {
        code: 'pattern-2',
        mediaTypes: {
          banner: {
            sizes: [[300, 250], [300, 600]]
          },
        },
      },
    }];

    hbDestination['gpt'].send(matches);
    expect(slotsRefreshed).to.equal(true);
    let slots = googletag.pubads().getSlots();
    expect(slots.length).to.equal(matches.length);

    let sizes = slots[0].getSizes();
    expect(sizes.length).to.equal(sizesWithFluid.length);
    for (let i = 0; i < sizes.length; i++) {
      if (Array.isArray(sizesWithFluid[i])) {
        expect(sizes[i].getWidth()).to.equal(sizesWithFluid[i][0]);
        expect(sizes[i].getHeight()).to.equal(sizesWithFluid[i][1]);
        continue;
      }
      expect(sizes[i]).to.equal(sizesWithFluid[i]);
    }
  });
});
