import * as utils from '../src/utils.js';
import { submodule } from '../src/hook.js';
import { getGlobal } from '../src/prebidGlobal.js';

/** @type {Submodule} */
export const auctionSourceSubmodule = {
  type: 'hbSource',
  name: 'auction',

  send,
  isValid(transactionObject) { return true; }
};

export function send(destinationObjects, callback) {
  utils.logInfo('[PPI] Triggering new HB auction');

  getGlobal().requestBids({
    adUnits: destinationObjects.filter(d => d.adUnit).map(destObj => destObj.adUnit),
    bidsBackHandler: (bids) => {
      utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
      if (utils.isFn(callback)) {
        callback();
      }
    }
  });
}

submodule('ppi', auctionSourceSubmodule);
