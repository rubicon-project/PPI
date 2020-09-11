import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';
import { filters } from '../../../src/targeting.js';

export function send(destinationObjects) {
  let pbjs = getGlobal();
  destinationObjects.forEach(destObj => {
    let callback = utils.deepAccess(destObj, 'transactionObject.hbDestination.values.callback');
    if (!utils.isFn(callback)) {
      utils.logError('[PPI] Callback is not a function ', callback);
      return;
    }
    if (!destObj.adUnit) {
      utils.logWarn('[PPI] adUnit not created for transaction object ', destObj.transactionObject);
      utils.logWarn('[PPI] executing callback without bids');
      callback();
      return;
    }
    let bids = pbjs.getBidResponsesForAdUnitCode(destObj.adUnit.code)
      .filter(filters.isUnusedBid)
      .filter(filters.isBidNotExpired);

    callback(bids);
  });
}
