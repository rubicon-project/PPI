import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';

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

    getGlobal().requestBids({
      adUnits: matchObjects.filter(mo => mo.adUnit).map(mo => mo.adUnit),
      bidsBackHandler: (bids) => {
        utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
        if (utils.isFn(callback)) {
          callback(matchObjects);
        }
      }
    });
  },
};
