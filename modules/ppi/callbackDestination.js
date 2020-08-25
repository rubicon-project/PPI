import { getGlobal } from '../../src/prebidGlobal.js';
import * as utils from '../../src/utils.js';

export function send(destinationObjects) {
  let pbjs = getGlobal();
  destinationObjects.forEach(destObj => {
    let bids = pbjs.getBidResponsesForAdUnitCode(destObj.adUnit.code);
    let callback = destObj.transactionObject.hbDestination.values.value;
    if (!utils.isFn(callback)) {
      utils.logError('[PPI] Callback is not a function ', callback);
      return;
    }

    callback(bids);
  });
}
