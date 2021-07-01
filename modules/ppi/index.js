import Set from 'core-js-pure/features/set';
import * as utils from '../../src/utils.js';
import { getGlobal } from '../../src/prebidGlobal.js';
import { hbSource } from './hbSource/hbSource.js';
import { hbDestination } from './hbDestination/hbDestination.js';
import { hbInventory } from './hbInventory/hbInventory.js';

let destinationRegistry = hbDestination;
let sourceRegistry = hbSource;
let inventoryRegistry = hbInventory;

/**
 * requestBids for each provided transactionObject
 * for transactionObjects create pbjs adUnits
 * request bids from source, it can be new HB auction or pbjs cache
 * send result to destionation, which could lead to:
 * ad rendering on the page
 * new bids being cached
 * @param {(Object[])} transactionObjects
 * @return {(Object[])} array of transactionObjects and matched adUnits
 */
export function requestBids(transactionObjects) {
  let validationResult = validateTransactionObjects(transactionObjects);
  let transactionResult = [];
  validationResult.invalid.forEach(inv => {
    utils.logError(`[PPI] provided invalid transaction object: ${inv.error}`, inv);
    transactionResult.push({
      transactionObject: inv,
    });
  });

  let groupedTransactionObjects = groupTransactionObjects(validationResult.valid);
  for (const source in groupedTransactionObjects) {
    for (const dest in groupedTransactionObjects[source]) {
      let matchObjects = inventoryRegistry.createAdUnits(groupedTransactionObjects[source][dest]);
      sourceRegistry[source].requestBids(matchObjects, (matches) => {
        destinationRegistry[dest].send(matches);
      });

      matchObjects.forEach(matchObj => {
        transactionResult.push({
          transactionObject: matchObj.transactionObject,
          adUnit: matchObj.adUnit,
        });
      });
    }
  }

  return transactionResult;
}

/**
 * Validate transaction objects
 *
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 * @return {Object.<string, string>} array of valid and invalid transactionObjects
 */
export function validateTransactionObjects(transactionObjects) {
  let valid = [];
  let invalid = [];

  const validTransactionTypes = new Set(inventoryRegistry.getTransactionTypes());
  const validDestinationTypes = new Set(Object.keys(destinationRegistry));
  const validSourceTypes = new Set(Object.keys(sourceRegistry));

  transactionObjects.forEach(to => {
    if (!validTransactionTypes.has(to.hbInventory.type)) {
      to.error = `provided inventory type ${to.hbInventory.type} not found`;
      invalid.push(to);
      return;
    }

    if (!validSourceTypes.has(to.hbSource.type)) {
      to.error = `hbSource ${to.hbSource.type} is not registered`;
      invalid.push(to);
      return;
    }

    if (!validDestinationTypes.has(to.hbDestination.type)) {
      to.error = `destination type ${to.hbDestination.type} not supported`
      invalid.push(to);
      return;
    }

    if (!inventoryRegistry.isValid(to)) {
      to.error = 'transaction object does not have valid inventory properties';
      invalid.push(to);
      return;
    }

    // validate sizes
    if (to.hbInventory.sizes) {
      if (!Array.isArray(to.hbInventory.sizes)) {
        to.error = 'sizes should be an array';
        invalid.push(to);
        return;
      }

      // to cover the usual error where [[300, 250]] --> [300, 250]
      if (Array.isArray(to.hbInventory.sizes) && typeof (to.hbInventory.sizes[0]) === 'number') {
        to.hbInventory.sizes = [to.hbInventory.sizes];
      }

      let isSizeValid = (size) => {
        return (Array.isArray(size) && size.length === 2 && typeof (size[0]) === 'number' && typeof (size[1]) === 'number') ||
          size === 'fluid';
      }

      to.hbInventory.sizes = to.hbInventory.sizes.filter(s => {
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
 * groups transaction objects
 * @param {(Object[])} transactionObjects array of transactionObjects to group
 * @return {Object.<string, Object.<string, string>>} slot - destination - array of transactionObjects mapping
 */
function groupTransactionObjects(transactionObjects) {
  let grouped = {};
  transactionObjects.forEach((transactionObject) => {
    let srcTransObj = grouped[transactionObject.hbSource.type] || {};
    let destTransObj = srcTransObj[transactionObject.hbDestination.type] || [];
    destTransObj.push(transactionObject);
    srcTransObj[transactionObject.hbDestination.type] = destTransObj;
    grouped[transactionObject.hbSource.type] = srcTransObj;
  });

  return grouped;
}

(getGlobal()).ppi = (getGlobal()).ppi || {};
(getGlobal()).ppi.requestBids = requestBids;
