import * as utils from '../../../src/utils.js';

/** @type {Submodule} */
export const cacheSourceSubmodule = {
  name: 'cache',

  send(matchObjects, callback) {
    utils.logInfo('[PPI] Using bids from bid cache');
    // TODO: Tech Spec states that we should trigger new auction if cache is emtpy
    if (utils.isFn(callback)) {
      callback();
    }
  },

  isValid(transactionObject) {
    return utils.deepAccess(transactionObject, 'hbDestination.type') !== 'cache';
  }
};
