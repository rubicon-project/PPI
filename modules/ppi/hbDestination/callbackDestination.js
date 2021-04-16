import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';
import { filters } from '../../../src/targeting.js';
import { config } from '../../../src/config.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to execute custom callback for each transactionObject
 * If transaction object has matched adUnit, this submodule will provided all eligible bids for that transactionObject
*/
export const callbackDestinationSubmodule = {
  name: 'callback',

  /**
   * send results to the callback, if transactionObject has matched adUnit, get all eligible bids and pass them in callback
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  send(matchObjects) {
    let pbjs = getGlobal();
    matchObjects.forEach(matchObj => {
      let callback = utils.deepAccess(matchObj, 'transactionObject.hbDestination.values.callback');
      if (!utils.isFn(callback)) {
        utils.logError('[PPI] Callback is not a function ', callback);
        return;
      }
      if (!matchObj.adUnit) {
        utils.logWarn('[PPI] adUnit not created for transaction object ', matchObj.transactionObject);
        utils.logWarn('[PPI] executing callback without bids');
        callback(matchObj);
        return;
      }
      let bids = pbjs.getBidResponsesForAdUnitCode(matchObj.adUnit.code).bids
        .filter(filters.isUnusedBid)
        .filter(filters.isBidNotExpired);

      if (bids.length && !config.getConfig('useBidCache')) {
        // find the last auction id to get responses for the most recent auction only
        const latestBid = bids.reduce((prev, current) => (prev.requestTimestamp > current.requestTimestamp) ? prev : current);
        const latestAuctionId = latestBid.auctionId;
        bids = bids.filter(bid => bid.auctionId === latestAuctionId)
      }

      callback(matchObj, bids);
    });
  },
};
