import * as utils from '../../../src/utils.js';

export function send(destinationObjects) {
  destinationObjects.forEach(destObj => {
    if (destObj.transactionObject.match.status) {
      utils.logInfo('[PPI] Cached bids for ', destObj.adUnit.code);
    }
  });
}
