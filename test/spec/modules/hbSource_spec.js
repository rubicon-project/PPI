import { expect } from 'chai';
import { hbSource } from 'modules/ppi/hbSource/hbSource.js';

describe('test ppi hbSource submodule', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test sending from auction hbSource submodule', () => {
    let bidsRequested = false;
    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler();
    });

    let matches = [{ adUnit: { code: 'test-1' } }];
    hbSource['auction'].send(matches, () => {
      bidsRequested = true;
    });

    expect(bidsRequested).to.equal(true);
  });

  it('test sending from cache hbSource with cached bids', () => {
    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      expect.fail('request bids should not be called');
    });

    const adUnitBids = {
      'test-1': {
        bids: [{
          responseTimestamp: new Date().getTime(),
          ttl: 1000,
          cpm: 1.12,
          status: 'available',
        }]
      }
    };

    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((code) => {
      return adUnitBids[code];
    });

    let matches = [{ adUnit: { code: 'test-1' } }];

    let cacheCallbackCalled = false;
    hbSource['cache'].send(matches, () => {
      cacheCallbackCalled = true;
    });

    expect(cacheCallbackCalled).to.equal(true);
  });

  it('test sending from cache hbSource without cached bids', () => {
    let bidsRequested = false;
    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsRequested = true;
      bidsBackHandler();
    });
    let matches = [{ adUnit: { code: 'test-1' } }];

    let cacheCallbackCalled = false;
    hbSource['cache'].send(matches, () => {
      cacheCallbackCalled = true;
    });

    expect(bidsRequested).to.equal(true);
    expect(cacheCallbackCalled).to.equal(true);
  });
});
