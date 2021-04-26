import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';
import { filters } from '../../../src/targeting.js';
import { config } from '../../../src/config.js';
import { auctionTracker } from './auctionTracker.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to requestBids from cache
 * If some adUnits don't have cached bids, this submodule will hold new HB auction for those adUnits
*/
export const cacheSourceSubmodule = {
  name: 'cache',

  /**
   * process transaction objects and matched adUnits
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  requestBids(matchObjects, callback) {
    let cachingEnabled = config.getConfig('useBidCache');
    if (!cachingEnabled) {
      utils.logWarn('[PPI] Enable bid caching (useBidCache: true) to use the cache source module!');
    }

    utils.logInfo('[PPI] Using bids from bid cache');
    // store match objects that don't have any bids and trigger new HB auction
    let emptyCacheMatches = [];
    let readyMatches = [];
    let pbjs = getGlobal();
    matchObjects.forEach(matchObj => {
      // no point in holding new HB auction if transaction object didn't create any adUnit
      if (!matchObj.adUnit) {
        readyMatches.push(matchObj);
        return;
      }

      let responses = pbjs.getBidResponsesForAdUnitCode(matchObj.adUnit.code);
      if (!responses || !responses.bids) {
        emptyCacheMatches.push(matchObj);
        return;
      }

      let bids = responses.bids
        .filter(filters.isUnusedBid)
        .filter(filters.isBidNotExpired)
        .filter(bid => bid.cpm > 0);

      if (!bids || !bids.length) {
        utils.logInfo(`[PPI] - did not find any bid for ${matchObj.adUnit.code}, queuing it for new HB auction`);
        emptyCacheMatches.push(matchObj);
        return;
      }

      matchObj.values = auctionTracker.getLatestAuction(matchObj.adUnit.code) || {};
      if (cachingEnabled) {
        // attach all bids from bid cache
        matchObj.values.bids = bids;
      }

      readyMatches.push(matchObj);
    });

    if (readyMatches.length && utils.isFn(callback)) {
      callback(readyMatches);
    }

    // adunits with empty cache need to be re-auctioned
    if (emptyCacheMatches.length) {
      pbjs.requestBids({
        adUnits: emptyCacheMatches.filter(mo => mo.adUnit).map(mo => mo.adUnit),
        bidsBackHandler: (bids, timedOut, auctionId) => {
          utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);

          // add matchObject.values and log the latest auction
          emptyCacheMatches.forEach(mo => {
            let auBids = bids && bids[mo.adUnit.code] && bids[mo.adUnit.code].bids;
            auctionTracker.setLatestAuction(mo.adUnit.code, auBids, timedOut, auctionId);

            mo.values = {
              bids: auBids,
              timedOut: timedOut,
              auctionId: auctionId,
            };
          });

          if (utils.isFn(callback)) {
            callback(emptyCacheMatches);
          }
        }
      });
    }
  },
};
