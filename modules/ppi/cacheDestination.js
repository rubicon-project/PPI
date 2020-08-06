import * as utils from '../../src/utils.js';

export function send(destinationObjects) {
  destinationObjects.forEach(destObj => {
    utils.logInfo('[PPI] Cached bids for ', destObj.adUnit.code);
  });
}
