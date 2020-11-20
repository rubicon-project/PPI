import * as utils from '../../../src/utils.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to cache bids
 * Since pbjs has caching mechanism, this submodule will only log that bids are cached
*/
export const cacheDestinationSubmodule = {
  name: 'cache',

  /**
   * send results to the cache, utilize pbjs cache and only log adUnit codes for which pbjs has cached bids
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  send(matchObjects) {
    matchObjects.forEach(matchObj => {
      if (matchObj.adUnit) {
        utils.logInfo('[PPI] Cached bids for ', matchObj.adUnit.code);
      }
    });
  },
};
