import * as utils from '../src/utils.js';
import { submodule } from '../src/hook.js';
import { getGlobal } from '../src/prebidGlobal.js';

/** @type {Submodule} */
export const auctionSourceSubmodule = {
  type: 'hbSource',
  name: 'auction',

  send(destinationObjects, callback) {
    if (!utils.isFn(callback)) {
      callback = () => { };
    }
    utils.logInfo('[PPI] Triggering new HB auction');

    getGlobal().requestBids({
      adUnits: destinationObjects.filter(d => d.adUnit).map(destObj => destObj.adUnit),
      bidsBackHandler: (bids) => {
        utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
        callback();
      }
    });
  },
};

submodule('ppi', auctionSourceSubmodule);
