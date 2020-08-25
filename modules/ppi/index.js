import * as utils from '../../src/utils.js';
import { hashFnv32a } from './utils.js';
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

  let validationResult = validateTransactionObjects(transactionObjects);
  let transactionResult = [];
  validationResult.invalid.forEach(inv => {
    utils.logError(`provided invalid transaction object`, inv);
    transactionResult.push(inv);
  });

  let allTOs = validationResult.valid.filter(to => { return to.type !== TransactionType.AUTO_SLOTS });
  allTOs = allTOs.concat(transformAutoSlots(validationResult.valid.filter(to => { return to.type === TransactionType.AUTO_SLOTS })));

  let groupedTransactionObjects = groupTransactionObjects(allTOs);
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
              utils.logInfo('PPI - bids from bids back handler: ', bids);
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
      let aupStr = JSON.stringify(aup);
      // clone the aup
      aup = JSON.parse(aupStr);
      aup.id = hashFnv32a(aupStr).toString(16);
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

function validateTransactionObjects(transactionObjects) {
  let valid = [];
  let invalid = [];

  const validTransactionTypes = new Set(Object.keys(TransactionType).map(t => TransactionType[t]));
  const validDestinationTypes = new Set(Object.keys(HBDestination).map(h => HBDestination[h].toLowerCase()));

  transactionObjects.forEach(to => {
    // check for type
    if (!validTransactionTypes.has(to.type)) {
      to.error = `provided type ${to.type} not found`;
      invalid.push(to);
      return;
    }
    if (to.type !== TransactionType.AUTO_SLOTS) {
      if (!to.value) {
        to.error = `for type ${to.type}, value must be provided, it can't be: ${to.value}`;
        invalid.push(to);
        return;
      }
    }
    if (!to.hbDestination || !to.hbDestination.type || !to.hbSource) {
      to.error = 'hbSource and/or hbDestionation not provided';
      invalid.push(to);
      return;
    }
    if (!validDestinationTypes.has(to.hbDestination.type.toLowerCase())) {
      to.error = `destination type ${to.hbDestination.type} not supported`
      invalid.push(to);
      return;
    }

    valid.push(to);
  });

  return {
    valid,
    invalid,
  }
}

function transformAutoSlots(transactionObjects) {
  if (!transactionObjects || !transactionObjects.length) {
    return [];
  }
  let gptSlots = [];
  try {
    gptSlots = window.googletag.pubads().getSlots();
  } catch (e) {
    utils.logError('could not get all gpt slots: ', e, ' is gpt initialized?');
  }

  if (!gptSlots || !gptSlots.length) {
    return [];
  }

  let result = [];
  transactionObjects.forEach(to => {
    let slotObjectTOs = [];
    gptSlots.forEach(gptSlot => {
      let slotObjectTO = {
        type: TransactionType.SLOT_OBJECT,
        value: gptSlot,
        hbSource: to.hbSource,
        hbDestination: to.hbDestination,
        sizes: to.sizes,
        targeting: to.targeting,
      };

      slotObjectTOs.push(slotObjectTO);
    });

    utils.logInfo('from autoSlot: ', to, 'created slot objects: ', slotObjectTOs);
    result = result.concat(slotObjectTOs);
  });

  return result;
}

function send(destination, objects) {
  switch (destination) {
    case HBDestination.GPT:
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
    name: transactionObject.value,
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
      case TransactionType.SLOT:
        if (!aup.slotPattern) {
          break;
        }

        return aup.slotPattern.test(transactionObject.value);
      case TransactionType.DIV:
        if (!aup.divPattern) {
          break;
        }

        return aup.divPattern.test(transactionObject.value);
      case TransactionType.SLOT_OBJECT:
        // NOTICE: gptSlotObjects -> gptSlotObject, in this demo we assume single gpt slot object per transaction object
        // we also assume that `transactionObject.value` carries the gpt slot object
        let match = true;
        if (aup.slotPattern) {
          match = aup.slotPattern.test(transactionObject.value.getAdUnitPath());
        }
        if (aup.divPattern) {
          match = match && aup.divPattern.test(transactionObject.value.getSlotElementId());
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
