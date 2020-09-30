import * as utils from '../src/utils.js';
import { submodule } from '../src/hook.js';

/** @type {Submodule} */
export const cacheSourceSubmodule = {
  type: 'hbSource',
  name: 'cache',

  send(destinationObjects, callback) {
    utils.logInfo('[PPI] Using bids from bid cache');
    if (!utils.isFn(callback)) {
      utils.logError('[PPI] Callback is not a function ', callback);
      return;
    }

    // TODO: Tech Spec states that we should trigger new auction if cache is emtpy
    callback();
  },

  isValid(transactionObject) {
    return utils.deepAccess(transactionObject, 'hbDestination.type') !== 'cache';
  }
};

submodule('ppi', cacheSourceSubmodule);
