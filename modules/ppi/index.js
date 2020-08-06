import * as utils from '../../src/utils.js';
import { getGlobal } from '../../src/prebidGlobal.js';
import { send as gptSend } from './gptDestination.js';
import { send as pageSend } from './pageDestination.js';
import { send as callbackSend } from './callbackDestination.js';
import { send as cacheSend } from './cacheDestination.js';
import { TransactionType, HBSource, HBDestination } from './consts.js';

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
        case HBSource.CACHE:
          send(dest, destObjects);
          break;
        case HBSource.AUCTION:
          getGlobal().requestBids({
            adUnits: destObjects.map(destObj => destObj.adUnit).filter(a => a),
            bidsBackHandler: (bids) => {
              send(dest, destObjects);
            }
          });
          break;
      }
    }
  }

  return transactionResult;
}

export function addAdUnitPatterns(aups) {
  aups.forEach(aup => {
    try {
      // clone the aup
      aup = JSON.parse(JSON.stringify(aup));
      if (aup.divPattern) {
        aup.divPattern = new RegExp(aup.divPattern, 'i');
      }
      if (aup.slotPattern) {
        aup.slotPattern = new RegExp(aup.slotPattern, 'i');
      }
      adUnitPatterns.push(aup);
    } catch (e) {
      utils.logError('[PPI] Error creating Ad Unit Pattern ', e)
    }
  });
}

function send(destination, objects) {
  switch (destination) {
    case HBDestination.GTP:
      gptSend(objects);
      break;
    case HBDestination.PAGE:
      pageSend(objects);
      break;
    case HBDestination.CALLBACK:
      callbackSend(objects);
      break;
    case HBDestination.CACHE:
      cacheSend(objects);
      break;
    default:
      utils.logError('[PPI] Unsupported destination module ', destination);
  }
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
        return aup.slotPattern.test(transactionObject.name);
      case TransactionType.DIV_PATTERN:
        if (!aup.divPattern) {
          break;
        }

        // 'transactionObject.name' should be renamed
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
  requestBids,
  addAdUnitPatterns,
  adUnitPatterns,
};
