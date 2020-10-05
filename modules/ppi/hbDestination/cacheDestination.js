import * as utils from '../../../src/utils.js';

/** @type {Submodule} */
export const cacheDestinationSubmodule = {
  name: 'cache',

  send(matchObjects) {
    matchObjects.forEach(matchObj => {
      if (matchObj.adUnit) {
        utils.logInfo('[PPI] Cached bids for ', matchObj.adUnit.code);
      }
    });
  },
};
