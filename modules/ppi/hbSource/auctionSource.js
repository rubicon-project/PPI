import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';
import { filters } from '../../../src/targeting.js';
import { config } from '../../../src/config.js';
import { auctionTracker } from './auctionTracker.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to requestBids from new HB auction
 * This submodule will hold new HB auction for matched adUnits and will execute provided callback
*/
export const auctionSourceSubmodule = {
  name: 'auction',

  /**
   * process transaction objects and matched adUnits, hold HB auction for matched adUnits
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  requestBids(matchObjects, callback) {
    utils.logInfo('[PPI] Triggering new HB auction');

    let pbjs = getGlobal();
    pbjs.requestBids({
      adUnits: matchObjects.filter(mo => mo.adUnit).map(mo => mo.adUnit),
      bidsBackHandler: (bids, timedOut, auctionId) => {
        utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);

        // add matchObject.values and log the latest auction
        matchObjects.forEach(mo => {
          if (!mo.adUnit) {
            return;
          }

          let auBids = bids && bids[mo.adUnit.code] && bids[mo.adUnit.code].bids;
          auctionTracker.setLatestAuction(mo.adUnit.code, auBids, timedOut, auctionId);

          // if bid caching is enabled, attach all bids
          if (config.getConfig('useBidCache')) {
            auBids = pbjs.getBidResponsesForAdUnitCode(mo.adUnit.code).bids
              .filter(filters.isUnusedBid)
              .filter(filters.isBidNotExpired);
          }

          mo.values = {
            bids: auBids,
            timedOut: timedOut,
            auctionId: auctionId,
          };
        });

        if (utils.isFn(callback)) {
          callback(matchObjects);
        }
      }
    });
  },
};
