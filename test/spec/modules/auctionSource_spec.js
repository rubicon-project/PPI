import { expect } from 'chai';
import { send } from 'modules/auctionSource.js'

describe('validate transaction objects', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should not accept invalid transaction objects', () => {
    let bidsBackHandlerExecuted = false;
    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler();
    });

    send([{ adUnit: { code: 'adUnit code' } }], () => {
      bidsBackHandlerExecuted = true;
    });

    expect(bidsBackHandlerExecuted).to.equal(true);
  });
});
