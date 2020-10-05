import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';

/** @type {Submodule} */
export const auctionSourceSubmodule = {
  name: 'auction',

  send(matchObjects, callback) {
    utils.logInfo('[PPI] Triggering new HB auction');

    getGlobal().requestBids({
      adUnits: matchObjects.filter(mo => mo.adUnit).map(mo => mo.adUnit),
      bidsBackHandler: (bids) => {
        utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
        if (utils.isFn(callback)) {
          callback(matchObjects);
        }
      }
    });
  },
  isValid(transactionObject) { return true; }
};
