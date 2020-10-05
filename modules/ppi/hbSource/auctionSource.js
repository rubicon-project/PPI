import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';

/** @type {Submodule} */
export const auctionSourceSubmodule = {
  name: 'auction',

  send(matchObjects, callback) {
    utils.logInfo('[PPI] Triggering new HB auction');

    getGlobal().requestBids({
      adUnits: matchObjects.filter(d => d.adUnit).map(matchObj => matchObj.adUnit),
      bidsBackHandler: (bids) => {
        utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
        if (utils.isFn(callback)) {
          callback();
        }
      }
    });
  },
  isValid(transactionObject) { return true; }
};
