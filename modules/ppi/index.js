
import { getGlobal } from '../../src/prebidGlobal.js';

export const HB_SOURCE_AUCTION = 'auction';
export const HB_SOURCE_CACHE = 'cache';
export const HB_DESTINATION_GPT = 'gpt';
export const HB_DESTINATION_CACHE = 'cache';
export const HB_DESTINATION_PAGE = 'page';
export const HB_DESTINATION_CALLBACK = 'callback';
/**
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 */
export function requestBids(transactionObjects) {
  // validate each transactionObject, log faulty one, use validated
  // group transactionObjects by source-destination pair.
  // for each transactionObject match adUnit pattern
  // for each matched adUnit pattern construct adUnits and hold hb auction (if source is not cache) and send result to destination module
  // for each matched adUnit pattern get cached bids and send them to destination module (if source is cache)

  let groupedTransactionObjects = groupTransactionObjects(transactionObjects);
  let transactionResult = [];
  let aups = [];
  for (const source in groupedTransactionObjects) {
    for (const dest in groupedTransactionObjects[source]) {
      groupedTransactionObjects[source][dest].forEach((transactionObject) => {
        let aup = findMatchingAUP(to, adUnitPatterns);
        if (aup) {
          aups.push(aup);
        } else {
          console.log("[PPI] No AUP matched for transaction object", transactionObject);
        }
        
        transactionResult.push(createTransactionResult(transactionObject, aup));
      });
    }
  }

  return transactionResult;
}

/**
 * group transaction objects
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 * @return {Object.<string, string>} adUnitCode gpt slot mapping
 */
export function groupTransactionObjects(transactionObjects) {
  let grouped = {};
  transactionObjects.forEach((transactionObject) => {
    let srcTransOjb = grouped[transactionObject.hbSource] || {};
    let destTransObj = srcTransOjb[transactionObject.hbDestination.type] || [];
    destTransObj.push(transactionObject);
    srcTransOjb[transactionObject.hbDestination.type] = destTransObj;
    grouped[transactionObject.hbSource] = srcTransOjb;
  });

  return grouped;
}

function createTransactionResult(transactionObject, adUnitPattern) {
  let aup;
  if (adUnitPattern) {
    aup = {
      divPattern: adUnitPattern.divPattern.toString(),
      slotPattern: adUnitPattern.slotPattern.toString(),
    };
  }

  return {
    name: transactionObject.name,
    type: transactionObject.type,
    hbSource: transactionObject.hbSource,
    hbDestination: transactionObject.hbDestination,
    match: {
      status: !!aup,
      aup: aup
    }
  };
}

function findMatchingAUP(transactionObject, adUnitPatterns) {
  return adUnitPatterns.find(aup => {
    switch(transactionObject.type) {
      case "slotPattern":
        if (!aup.slotPattern) {
          break;
        }  
      
        // 'transactionObject.name' should be renamed
        // TODO: create new RegExp() out of regex strings
        return aup.slotPattern.test(transactionObject.name);
      case "divPattern":
        if (!aup.divPattern) {
          break;
        }  
      
        // 'transactionObject.name' should be renamed
        // TODO: create new RegExp() out of regex strings
        return aup.divPattern.test(transactionObject.name);
      case "gptSlotObject":
        // NOTICE: gptSlotObjects -> gptSlotObject, in this demo we assume single gpt slot object per transaction object
        // we also assume that `transactionObject.name` carries the gpt slot object
        let match = true;
        if (aup.slotPattern) {
          match = aup.slotPattern.test(transactionObject.name.getAdUnitPath());
        }
        if (aup.divPattern) {
          match = match && aup.divPattern.test(transactionObject.name.getSlotElementId());
        }

        // AUP validation should guarantee that AUP has at least one pattern (div or slot)
        return match;
      default:
        // this should never happen
        // if transaction object passed validation
        console.log("[PPI] Invalid transaction object type", transactionObject.type)
    }

    return false;
  });
}

const adUnitPatterns = [];

(getGlobal()).ppi = {
  refreshBids: requestBids,
  adUnitPatterns: adUnitPatterns,
};


// ------------------------
// Questions:
//  - aup slot/div pattern matches against transaction object pattern? Both are patterns, shouldn't transaction object have concrete values?
//  - transaction object of type 'gptSlotObjects' should recieve array of gpt slot objects, how? do we match one aup per passed gpt slot object? can we then break it one gpt slot object per transaction object?

