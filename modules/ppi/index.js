
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
        aups.push(dest);
        aups = [];

        transactionResult.push(createTransactionResult(transactionObject, {}));
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
  return {
    name: transactionObject.name,
    type: transactionObject.type,
    hbSource: transactionObject.hbSource,
    hbDestination: transactionObject.hbDestination,
    match: {
      status: true,
      aup: {
        divPattern: adUnitPattern.divPattern,
        slotPattern: adUnitPattern.slotPattern,
      }
    }
  };
}

(getGlobal()).ppi = {
  refreshBids: requestBids,
};
