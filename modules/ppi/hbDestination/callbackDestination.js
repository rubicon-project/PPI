import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';
import { filters } from '../../../src/targeting.js';

/** @type {Submodule} */
export const callbackDestinationSubmodule = {
  name: 'callback',

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
        callback();
        return;
      }
      let bids = pbjs.getBidResponsesForAdUnitCode(matchObj.adUnit.code)
        .filter(filters.isUnusedBid)
        .filter(filters.isBidNotExpired);

      callback(bids);
    });
  },
};
