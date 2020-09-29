import * as utils from '../../src/utils.js';
import { getGlobal } from '../../src/prebidGlobal.js';
import { TransactionType, HBSource, HBDestination, ModuleType } from './consts.js';
import { module } from '../../src/hook.js';

/** @type {Submodule[name]->handle} */
let destinationRegistry = {};
let sourceRegistry = {};
let inventoryRegistry = {};

// used to track if requestBids was called
// let bidsRequested = false;
/**
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 */
export function requestBids(transactionObjects) {
  // bidsRequested = true;
  let validationResult = validateTransactionObjects(transactionObjects);
  let transactionResult = [];
  validationResult.invalid.forEach(inv => {
    utils.logError(`[PPI] provided invalid transaction object`, inv);
    transactionResult.push({
      transactionObject: inv,
    });
  });

  let groupedTransactionObjects = groupTransactionObjects(validationResult.valid);
  for (const source in groupedTransactionObjects) {
    for (const dest in groupedTransactionObjects[source]) {
      let destObjects = inventoryRegistry.createAdUnits(groupedTransactionObjects[source][dest]);
      sourceRegistry[source].send(destObjects, () => {
        destinationRegistry[dest].send(destObjects);
      });

      destObjects.forEach(destObj => {
        transactionResult.push({
          transactionObject: destObj.transactionObject,
          adUnit: destObj.adUnit,
        });
      });
    }
  }

  return transactionResult;
}

export function validateTransactionObjects(transactionObjects) {
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
    if (to.hbSource !== HBSource.AUCTION && to.hbSource !== HBSource.CACHE) {
      to.error = `hbSource: ${to.hbSource} is not equal to ${HBSource.AUCTION} or ${HBSource.CACHE}`;
      invalid.push(to);
      return;
    }
    if (!to.hbDestination || !to.hbDestination.type) {
      to.error = 'hbDestionation.type not provided';
      invalid.push(to);
      return;
    }
    if (!validDestinationTypes.has(to.hbDestination.type.toLowerCase())) {
      to.error = `destination type ${to.hbDestination.type} not supported`
      invalid.push(to);
      return;
    }

    if (to.hbDestination.type === HBDestination.CACHE && to.hbSource === HBSource.CACHE) {
      to.error = `destination and source can't be cache at the same time`;
      invalid.push(to);
      return;
    }

    // validate sizes
    if (to.sizes) {
      if (!Array.isArray(to.sizes)) {
        to.error = 'sizes should be an array';
        invalid.push(to);
        return;
      }

      // to cover the usual error where [[300, 250]] --> [300, 250]
      if (Array.isArray(to.sizes) && typeof (to.sizes[0]) === 'number') {
        to.sizes = [to.sizes];
      }

      to.sizes = to.sizes.filter(s => {
        if (!isSizeValid(s)) {
          utils.logError('[PPI] Invalid size', s);
          return false;
        }

        return true;
      });
    }

    valid.push(to);
  });

  return {
    valid,
    invalid,
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

function isSizeValid(size) {
  return Array.isArray(size) && size.length === 2 && typeof (size[0]) === 'number' && typeof (size[1]) === 'number';
}

/**
 * enable submodule in PPI
 * @param {Submodule} submodule
 */
export function attachSubmodule(submodule) {
  switch (submodule.type) {
    case ModuleType.HBInventory:
      inventoryRegistry = submodule;
      break;
    case ModuleType.HBSource:
      sourceRegistry[submodule.name] = submodule;
      break;
    case ModuleType.HBDestination:
      destinationRegistry[submodule.name] = submodule;
      break;
    default:
      utils.logError('[PPI] Invalid submodule type', submodule.type);
      break;
  }
}

export const adUnitPatterns = [];

(getGlobal()).ppi = (getGlobal()).ppi || {};
(getGlobal()).ppi.requestBids = requestBids;

module('ppi', attachSubmodule);
