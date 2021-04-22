import * as utils from '../../../src/utils.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to execute custom callback for each transactionObject
 * If transaction object has matched adUnit, this submodule will provided all eligible bids for that transactionObject
*/
export const callbackDestinationSubmodule = {
  name: 'callback',

  /**
   * send results to the callback, if transactionObject has matched adUnit, get all eligible bids and pass them in callback
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  send(matchObjects) {
    matchObjects.forEach(matchObj => {
      let callback = utils.deepAccess(matchObj, 'transactionObject.hbDestination.values.callback');
      if (!utils.isFn(callback)) {
        utils.logError('[PPI] Callback is not a function ', callback);
        return;
      }

      if (!matchObj.adUnit) {
        utils.logWarn('[PPI] adUnit not created for transaction object ', matchObj.transactionObject);
      }

      callback(matchObj);
    });
  },
};
