import { expect } from 'chai';
import { hbSource } from 'modules/ppi/hbSource/hbSource.js';
import { config as configObj } from 'src/config.js';

describe('test ppi hbSource submodule', () => {
  let sandbox;
  beforeEach(() => {
    configObj.setConfig({ useBidCache: false });
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
    hbSource['auction'].requestBids(matches, () => {
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
    hbSource['cache'].requestBids(matches, () => {
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
    hbSource['cache'].requestBids(matches, () => {
      cacheCallbackCalled = true;
    });

    expect(bidsRequested).to.equal(true);
    expect(cacheCallbackCalled).to.equal(true);
  });

  it('should attach values to matchObject', () => {
    const adUnitBids = {
      'test-1': {
        bids: [{
          responseTimestamp: new Date().getTime(),
          ttl: 1000,
          cpm: 1.12,
          status: 'available',
          adUnitCode: 'test-1',
          auctionId: '1234-56789-0000',
        }]
      }
    };

    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler(adUnitBids, false, '1234-56789-0000');
    });

    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((code) => {
      return adUnitBids[code];
    });

    let matches = [{ adUnit: { code: 'test-1' } }];

    let destMos;
    hbSource['auction'].requestBids(matches, (mos) => {
      destMos = mos;
    });

    expect(destMos.length).to.equal(1);
    expect(destMos[0].values).to.not.be.undefined;
    expect(destMos[0].values.auctionId).to.equal('1234-56789-0000');
    expect(destMos[0].values.timedOut).to.be.false;
    expect(destMos[0].values.bids).to.equal(adUnitBids['test-1'].bids);
  });

  it('should attach all bids to match object', () => {
    configObj.setConfig({ useBidCache: true });
    const latestBid = {
      responseTimestamp: new Date().getTime(),
      ttl: 1000,
      cpm: 1.12,
      status: 'available',
      adUnitCode: 'test-1',
      auctionId: '1234-56789-0001',
    };

    const adUnitBids = {
      'test-1': {
        bids: [{
          responseTimestamp: new Date().getTime(),
          ttl: 1000,
          cpm: 0.12,
          status: 'available',
          adUnitCode: 'test-1',
          auctionId: '1234-56789-0000',
        }, latestBid]
      }
    };

    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler({
        'test-1': {
          bids: [latestBid]
        }
      }, true, '1234-56789-0001');
    });

    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((code) => {
      return adUnitBids[code];
    });

    let matches = [{ adUnit: { code: 'test-1' } }];

    let destMos;
    hbSource['auction'].requestBids(matches, (mos) => {
      destMos = mos;
    });

    expect(destMos.length).to.equal(1);
    expect(destMos[0].values).to.not.be.undefined;
    expect(destMos[0].values.auctionId).to.equal('1234-56789-0001');
    expect(destMos[0].values.timedOut).to.be.true;
    expect(destMos[0].values.bids.length).to.equal(2);
    expect(destMos[0].values.bids[0]).to.equal(adUnitBids['test-1'].bids[0]);
    expect(destMos[0].values.bids[1]).to.equal(adUnitBids['test-1'].bids[1]);
  });

  it('should attach only latest bid to match object', () => {
    const latestBid = {
      responseTimestamp: new Date().getTime(),
      ttl: 1000,
      cpm: 1.12,
      status: 'available',
      adUnitCode: 'test-1',
      auctionId: '1234-56789-0001',
    };

    const adUnitBids = {
      'test-1': {
        bids: [{
          responseTimestamp: new Date().getTime(),
          ttl: 1000,
          cpm: 0.12,
          status: 'available',
          adUnitCode: 'test-1',
          auctionId: '1234-56789-0000',
        }, latestBid]
      }
    };

    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ bidsBackHandler }) => {
      bidsBackHandler({
        'test-1': {
          bids: [latestBid]
        }
      }, true, '1234-56789-0001');
    });

    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((code) => {
      return adUnitBids[code];
    });

    let matches = [{ adUnit: { code: 'test-1' } }];

    let destMos;
    hbSource['auction'].requestBids(matches, (mos) => {
      destMos = mos;
    });

    expect(destMos.length).to.equal(1);
    expect(destMos[0].values).to.not.be.undefined;
    expect(destMos[0].values.auctionId).to.equal('1234-56789-0001');
    expect(destMos[0].values.timedOut).to.be.true;
    expect(destMos[0].values.bids.length).to.equal(1);
    expect(destMos[0].values.bids[0]).to.equal(latestBid);
  });

  it('should not attach values to match object when no ad unit got matched', () => {
    let destMos;
    hbSource['cache'].requestBids([{ transcactionObject: {}, adUnit: undefined }], (mos) => {
      destMos = mos;
    });

    expect(destMos.length).to.equal(1);
    expect(destMos[0].values).to.be.undefined;
  });

  it('should reauction units without bids', () => {
    configObj.setConfig({ useBidCache: true });
    const latestBid = {
      responseTimestamp: new Date().getTime(),
      ttl: 1000,
      cpm: 1.12,
      status: 'available',
      adUnitCode: 'test-2',
      auctionId: '1234-56789-0001',
    };

    const adUnitBids = {
      'test-1': {
        bids: [{
          responseTimestamp: new Date().getTime(),
          ttl: 1000,
          cpm: 0.12,
          status: 'available',
          adUnitCode: 'test-1',
          auctionId: '1234-56789-0000',
        }]
      }
    };

    sandbox.stub($$PREBID_GLOBAL$$, 'requestBids').callsFake(({ adUnits, bidsBackHandler }) => {
      if (adUnits.length != 1 || adUnits[0].code != 'test-2') {
        expect.fail('request bids should be called only for test-2 adUnit');
      }

      bidsBackHandler({
        'test-2': {
          bids: [latestBid]
        }
      }, true, '1234-56789-0001');
    });

    sandbox.stub($$PREBID_GLOBAL$$, 'getBidResponsesForAdUnitCode').callsFake((code) => {
      return adUnitBids[code];
    });

    let matches = [
      { transactionObject: {}, adUnit: { code: 'test-1' } },
      { transactionObject: {}, adUnit: { code: 'test-2' } },
      { transactionObject: {}, adUnit: undefined }
    ];

    let destMos = [];
    let destCalled = 0;
    hbSource['cache'].requestBids(matches, (mos) => {
      destCalled++;
      destMos = destMos.concat(mos);
    });

    expect(destCalled).to.equal(2);
    expect(destMos.length).to.equal(3);
    expect(destMos.some(mo => mo.adUnit == undefined)).to.be.true;
    expect(destMos.some(mo => mo.adUnit && mo.adUnit.code == 'test-1' && mo.values.bids[0].auctionId == '1234-56789-0000')).to.be.true;
    expect(destMos.some(mo => mo.adUnit && mo.adUnit.code == 'test-2' && mo.values.auctionId == '1234-56789-0001')).to.be.true;
  });
});
