import * as utils from '../../../src/utils.js';

/** @type {Submodule} */
export const cacheDestinationSubmodule = {
  name: 'cache',

  send(destinationObjects) {
    destinationObjects.forEach(destObj => {
      if (destObj.adUnit) {
        utils.logInfo('[PPI] Cached bids for ', destObj.adUnit.code);
      }
    });
  },
};
