import * as utils from '../../../src/utils.js';
import { getGlobal } from '../../../src/prebidGlobal.js';
import { filters } from '../../../src/targeting.js';

/** @type {Submodule} */
export const cacheSourceSubmodule = {
  name: 'cache',

  send(matchObjects, callback) {
    utils.logInfo('[PPI] Using bids from bid cache');
    // Tech Spec states that we should trigger a new auction if cache is empty
    let emptyCacheMatches = [];
    let readyMatches = [];
    let pbjs = getGlobal();
    matchObjects.forEach(matchObj => {
      if (!matchObj.adUnit) {
        readyMatches.push(matchObj);
        return;
      }

      let responses = pbjs.getBidResponsesForAdUnitCode(matchObj.adUnit.code);
      if (!responses || !responses.bids) {
        emptyCacheMatches.push(matchObj);
        return;
      }

      let bids = responses.bids
        .filter(filters.isUnusedBid)
        .filter(filters.isBidNotExpired)
        .filter(bid => bid.cpm > 0);

      if (!bids || !bids.length) {
        utils.logInfo(`[PPI] - did not find any bid for ${matchObj.adUnit.code}, queuing it for new HB auction`);
        emptyCacheMatches.push(matchObj);
        return;
      }

      readyMatches.push(matchObj);
    });

    // send the ready matches to destination module
    if (readyMatches.length && utils.isFn(callback)) {
      callback(readyMatches);
    }

    // adunits with empty cache need to be re-auctioned
    if (emptyCacheMatches.length) {
      pbjs.requestBids({
        adUnits: emptyCacheMatches.filter(mo => mo.adUnit).map(mo => mo.adUnit),
        bidsBackHandler: (bids) => {
          utils.logInfo('[PPI] - bids from bidsBackHandler: ', bids);
          if (utils.isFn(callback)) {
            callback(emptyCacheMatches);
          }
        }
      });
    }
  },

  isValid(transactionObject) {
    return utils.deepAccess(transactionObject, 'hbDestination.type') !== 'cache';
  }
};
