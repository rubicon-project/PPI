import * as utils from '../src/utils.js';
import { submodule } from '../src/hook.js';

/** @type {Submodule} */
export const cacheDestinationSubmodule = {
  type: 'hbDestination',
  name: 'cache',

  send(destinationObjects) {
    destinationObjects.forEach(destObj => {
      if (destObj.transactionObject.match.status) {
        utils.logInfo('[PPI] Cached bids for ', destObj.adUnit.code);
      }
    });
  },
};

submodule('ppi', cacheDestinationSubmodule);
