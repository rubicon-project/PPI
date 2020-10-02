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

  it('test sending from hbSource submodule', () => {
    let bidsRequested = false;
    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler();
    });

    let matches = [{ adUnit: { code: 'adUnit code' } }];
    hbSource['auction'].send(matches, () => {
      bidsRequested = true;
    });

    expect(bidsRequested).to.equal(true);
    bidsRequested = false;

    let cacheCallbackCalled = false;
    hbSource['cache'].send(matches, () => {
      cacheCallbackCalled = true;
    });

    expect(bidsRequested).to.equal(false);
    expect(cacheCallbackCalled).to.equal(true);
  });
});
