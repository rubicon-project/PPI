
import { getGlobal } from '../../src/prebidGlobal.js';
import * as utils from '../../src/utils.js';
import { send } from './gptDestination.js';

export const HB_SOURCE_AUCTION = 'auction';
export const HB_SOURCE_CACHE = 'cache';
export const HB_DESTINATION_GPT = 'gpt';
export const HB_DESTINATION_CACHE = 'cache';
export const HB_DESTINATION_PAGE = 'page';
export const HB_DESTINATION_CALLBACK = 'callback';
export const TransactionType = {
  SLOT_PATTERN: 'slotPattern',
  DIV_PATTERN: 'divPattern',
  GPT_SLOT_OBJECT: 'gptSlotObject'
};

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
  for (const source in groupedTransactionObjects) {
    for (const dest in groupedTransactionObjects[source]) {
      let destObjects = []; // TODO: rename
      groupedTransactionObjects[source][dest].forEach((to) => {
        // TODO: what if we get the same AUP for two different transaction objects?
        let aup = findMatchingAUP(to, adUnitPatterns);
        let au;
        if (aup) {
          // create ad unit
          au = createAdUnit(aup);
        } else {
          utils.logWarn('[PPI] No AUP matched for transaction object', to);
        }

        destObjects.push({
          adUnit: au,
          transactionObject: to,
        });
        transactionResult.push(createTransactionResult(to, aup));
      });

      switch (source) {
        case HB_SOURCE_CACHE:
          send(destObjects);
          break;

        case HB_SOURCE_AUCTION:
          getGlobal().requestBids({
            adUnits: destObjects.map(destObj => destObj.adUnit),
            bidsBackHandler: (bids) => {
              send(destObjects);
            }
          })
          break;
      }
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
    let srcTransObj = grouped[transactionObject.hbSource] || {};
    let destTransObj = srcTransObj[transactionObject.hbDestination.type] || [];
    destTransObj.push(transactionObject);
    srcTransObj[transactionObject.hbDestination.type] = destTransObj;
    grouped[transactionObject.hbSource] = srcTransObj;
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
    switch (transactionObject.type) {
      case TransactionType.SLOT_PATTERN:
        if (!aup.slotPattern) {
          break;
        }

        // 'transactionObject.name' should be renamed
        // TODO: create new RegExp() out of regex strings
        return aup.slotPattern.test(transactionObject.name);
      case TransactionType.DIV_PATTERN:
        if (!aup.divPattern) {
          break;
        }

        // 'transactionObject.name' should be renamed
        // TODO: create new RegExp() out of regex strings
        return aup.divPattern.test(transactionObject.name);
      case TransactionType.GPT_SLOT_OBJECT:
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
        utils.logError('[PPI] Invalid transaction object type', transactionObject.type)
    }

    return false;
  });
}

function createAdUnit(adUnitPattern) {
  let adUnit;
  try {
    // copy pattern for conversion into adUnit
    adUnit = JSON.parse(JSON.stringify(adUnitPattern));
    adUnit.code = adUnitPattern.id;
    if (adUnit.mediaTypes && adUnit.mediaTypes.banner) {
      adUnit.mediaTypes.banner.sizes = adUnit.filteredSizes;
    } else {
      adUnit.sizes = adUnit.filteredSizes;
    }

    // Remove pattern properties not included in adUnit
    delete adUnit.id;
    delete adUnit.slotPattern;
    delete adUnit.divPattern;

    // attach transactionId
    if (!adUnit.transactionId) {
      adUnit.transactionId = utils.generateUUID();
    }
  } catch (e) {
    utils.logError('[PPI] error parsing adUnit', e);
  }

  return adUnit;
}

const adUnitPatterns = [];

(getGlobal()).ppi = {
  refreshBids: requestBids,
  adUnitPatterns: adUnitPatterns,
};
