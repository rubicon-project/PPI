import { getGlobal } from '../../src/prebidGlobal.js';
import * as utils from '../../src/utils.js';

export const adUnitPatterns = [];
function addAdUnitPatterns(aups) {
  aups.forEach(aup => {
    try {
      aup = JSON.parse(JSON.stringify(aup));
      // TODO: every submodule should implement it's own validation, I guess
      // aup = validateAUP(aup);
      if (aup.error) {
        throw aup.error;
      }
      if (aup.divPattern) {
        aup.divPatternRegex = new RegExp(aup.divPattern, 'i');
      }
      if (aup.slotPattern) {
        aup.slotPatternRegex = new RegExp(aup.slotPattern, 'i');
      }
      adUnitPatterns.push(aup);
    } catch (e) {
      utils.logError('[PPI] Error creating Ad Unit Pattern ', e)
    }
  });
}

/**
 * @param {function} mappingFunction - to map custom params to adUnits.
 *                     function should accept two arguments: to: <transactionObject>, aup: <adUnitPattern>
 *                     function returns true if transaction object matches ad unit pattern, else false
 */
let customMappingFunction;
export function setCustomMappingFunction(mappingFunction) {
  // TODO: instead of tracking bidsRequested (line in original draft impl), track if createAdUnit was already called
  // if (bidsRequested) {
  //   utils.logWarn('[PPI] calling setCustomMappingFunction after requestBids could cause ad serving discrepancies or race conditions.');
  // }

  if (!utils.isFn(mappingFunction)) {
    utils.logError('[PPI] custom mapping function must be a function', mappingFunction);
    return;
  }

  customMappingFunction = mappingFunction;
}

(getGlobal()).ppi = (getGlobal()).ppi || {};
(getGlobal()).ppi.addAdUnitPatterns = addAdUnitPatterns;
(getGlobal()).ppi.setCustomMappingFunction = setCustomMappingFunction;
