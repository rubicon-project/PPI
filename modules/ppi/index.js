import * as utils from '../../src/utils.js';
import { hashFnv32a, getViewport, find } from './utils.js';
import { getGlobal } from '../../src/prebidGlobal.js';
import { TransactionType, HBSource, HBDestination, ModuleType } from './consts.js';
import { module } from '../../src/hook.js';

/** @type {Submodule[name]->handle} */
let destinationRegistry = {};
let sourceRegistry = {};
let inventoryRegistry = {};

// used to track if requestBids was called
let bidsRequested = false;
/**
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 */
export function requestBids(transactionObjects) {
  bidsRequested = true;
  let validationResult = validateTransactionObjects(transactionObjects);
  let transactionResult = [];
  validationResult.invalid.forEach(inv => {
    utils.logError(`[PPI] provided invalid transaction object`, inv);
    transactionResult.push(inv);
  });

  let allTOs = validationResult.valid.filter(to => { return to.type !== TransactionType.AUTO_SLOTS });
  allTOs = allTOs.concat(transformAutoSlots(validationResult.valid.filter(to => { return to.type === TransactionType.AUTO_SLOTS })));

  let groupedTransactionObjects = groupTransactionObjects(allTOs);
  for (const source in groupedTransactionObjects) {
    for (const dest in groupedTransactionObjects[source]) {
      let destObjects = []; // TODO: rename
      let toAUPPair = getTOAUPPair(groupedTransactionObjects[source][dest], adUnitPatterns);
      toAUPPair.forEach(toAUP => {
        let aup = toAUP.adUnitPattern;
        let to = toAUP.transactionObject;
        let au;
        if (aup) {
          au = createAdUnit(aup, to);
          applyFirstPartyData(au, aup, to);
        }

        let tr = createTransactionResult(to, aup);
        destObjects.push({
          adUnit: au,
          transactionObject: tr,
        });
        transactionResult.push(tr);
      });

      sourceRegistry[source].send(destObjects, () => {
        destinationRegistry[dest].send(destObjects);
      });
    }
  }

  return transactionResult;
}

function getGPTSlotName(transactionObject, adUnitPattern) {
  switch (transactionObject.type) {
    case TransactionType.SLOT:
      return transactionObject.value;
    case TransactionType.DIV:
      // TODO: check if .*^$ are valid regex markers
      let isRegex = ['.', '*', '^', '$'].some(p => adUnitPattern.slotPattern.indexOf(p) !== -1);
      return isRegex ? '' : adUnitPattern.slotPattern;
    case TransactionType.SLOT_OBJECT:
      return transactionObject.value.getAdUnitPath();
  }

  return '';
}

export function addAdUnitPatterns(aups) {
  aups.forEach(aup => {
    try {
      aup = JSON.parse(JSON.stringify(aup));
      aup = validateAUP(aup);
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
  if (bidsRequested) {
    utils.logWarn('[PPI] calling setCustomMappingFunction after requestBids could cause ad serving discrepancies or race conditions.');
  }

  if (!utils.isFn(mappingFunction)) {
    utils.logError('[PPI] custom mapping function must be a function', mappingFunction);
    return;
  }

  customMappingFunction = mappingFunction;
}

export function addSizeMappings(sizeMappings) {
  sizeMappings = sizeMappings || {};
  let pbjs = getGlobal();
  pbjs.ppi.sizeMappings = pbjs.ppi.sizeMappings || {};
  for (var slotId in sizeMappings) {
    if (sizeMappings.hasOwnProperty(slotId)) {
      pbjs.ppi.sizeMappings[slotId] = sizeMappings[slotId];
    }
  }
}

function getSizeMappingSizes(divId, viewport) {
  let sizeMappings = getGlobal().ppi.sizeMappings;
  if (!sizeMappings) {
    return;
  }

  // TODO: replace with isRegex function in (./utils.js)
  if (['.', '*', '^', '$'].some(p => divId.indexOf(p) !== -1)) {
    divId = '__global__';
  }

  let divSizeMappings = sizeMappings[divId] || sizeMappings['__global__'];
  return filterSizeMappingSizes(divSizeMappings, viewport);
}

/**
 * @param {Object} sizeMapping array of viewport -> adUnit size mappings where each size is [w, h]
 *     [
 *       {minViewPort: viewportSize1, sizes: [adUnitSize1, adUnitSize2, etc]}
 *       {minViewPort: viewportSize2, sizes: [adUnitSize1, adUnitSize2, etc]}
 *       etc
 *     ]
 * @param {Array} viewport dimensions [width, height]
 * @returns {Array} of available sizes based on current viewport or undefined if no matching viewport found
 */
function filterSizeMappingSizes(sizeMappings, viewport) {
  if (!sizeMappings) {
    return;
  }

  let sizes;
  try {
    // sort sizeMappings from biggest to smallest viewport
    // then find the biggest one that fits in the given viewport
    let val = (find(sizeMappings.sort((a, b) => {
      let aVP = a.minViewPort;
      let bVP = b.minViewPort;
      return bVP[0] * bVP[1] - aVP[0] * aVP[1] || bVP[0] - aVP[0] || bVP[1] - aVP[1];
    }), (sizeMapping) => {
      return viewport[0] >= sizeMapping.minViewPort[0] && viewport[1] >= sizeMapping.minViewPort[1];
    }));
    sizes = val && val.sizes;
  } catch (e) {
    utils.logError('[PPI] while parsing sizeMappings:', sizeMappings, e);
  }

  return sizes;
}

function validateAUP(aup) {
  if (!aup.divPattern && !aup.slotPattern) {
    aup.error = `can't create AUP without slot pattern or div pattern`;
    return aup;
  }
  let aupSizes = utils.deepAccess(aup, 'mediaTypes.banner.sizes');
  // validate sizes
  if (aupSizes) {
    if (!Array.isArray(aupSizes)) {
      aup.error = 'sizes should be an array';
      return aup;
    }

    // to cover the usual error where [[300, 250]] --> [300, 250]
    if (Array.isArray(aupSizes) && typeof (aupSizes[0]) === 'number') {
      aupSizes = [aupSizes];
    }

    aupSizes = aupSizes.filter(s => {
      if (!isSizeValid(s)) {
        utils.logError('[PPI] Invalid AUP size', s);
        return false;
      }

      return true;
    });

    utils.deepSetValue(aup, 'mediaTypes.banner.sizes', aupSizes);
  }

  return aup;
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

export function transformAutoSlots(transactionObjects) {
  if (!transactionObjects || !transactionObjects.length) {
    return [];
  }
  let gptSlots = [];
  try {
    gptSlots = window.googletag.pubads().getSlots();
  } catch (e) {
    utils.logError('[PPI] - could not get all gpt slots: ', e, ' is gpt initialized?');
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

    utils.logInfo('[PPI] - from autoSlot: ', to, 'created slot objects: ', slotObjectTOs);
    result = result.concat(slotObjectTOs);
  });

  return result;
}

// sortSizes in place, descending, by area, width, height
function sortSizes(sizes) {
  return sizes.sort((a, b) => {
    return b[0] * b[1] - a[0] * a[1] || b[0] - b[0] || a[1] - a[1];
  });
}

/**
 * @param {Array.<Array>} currentSizes
 * @param {Array.<Array>} allowedSizes
 * @returns {Array.<Array>}
 */
function filterSizesByIntersection(currentSizes, allowedSizes) {
  return currentSizes.filter(function (size) {
    return hasValidSize(size, allowedSizes);
  });
}

function isSizeValid(size) {
  return Array.isArray(size) && size.length === 2 && typeof (size[0]) === 'number' && typeof (size[1]) === 'number';
}

/**
 * @param {Array.<Array>} size
 * @param {Array.<Array>} allowedSizes
 * @returns {boolean}
 */
function hasValidSize(size, allowedSizes) {
  return allowedSizes.some(function (allowedSize) {
    return (size[0] === allowedSize[0] && size[1] === allowedSize[1]);
  });
}

/**
 * Gets the given gpt slot's sizes in an array formatted [[w,h],...],
 *      excluding any "Fluid" sizes (which don't have a width or height
 * @param {googletag.Slot} gptSlot
 * @returns {Array} - gpt slot sizes array formatted [[w,h],...]
 */
function getGptSlotSizes(gptSlot) {
  let gptSlotSizes = gptSlot.getSizes();
  // if no sizes array, just return undefined (not sure if this is valid, but being defensive)
  if (!gptSlotSizes) {
    return;
  }

  // map gpt sizes to [[w,h],...] array (filter out "fluid" size)
  return gptSlotSizes.filter((gptSlotSize) => {
    if (typeof gptSlotSize.getHeight !== 'function' || typeof gptSlotSize.getWidth !== 'function') {
      utils.logWarn('[PPI] - skipping "fluid" ad size for gpt slot:', gptSlot);
      return false;
    }
    return true;
  }).map((gptSlotSize) => {
    return [
      gptSlotSize.getWidth(),
      gptSlotSize.getHeight()
    ];
  });
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

function createTransactionResult(transactionObject, aup) {
  let transactionResult = utils.deepClone(transactionObject);
  transactionResult.match = {
    status: !!aup,
    aup: aup && utils.deepClone(aup),
  }

  return transactionResult;
}

export function getTOAUPPair(transactionObjects, adUnitPatterns) {
  let result = [];
  let lock = new Set();
  transactionObjects.forEach(to => {
    let aups = findMatchingAUPs(to, adUnitPatterns).filter(a => {
      let isLocked = lock.has(a)
      if (isLocked) {
        utils.logWarn('[PPI] aup was already matched for one of the previous transaction object, will skip it. AUP: ', a);
      }
      return !isLocked;
    });

    let aup;
    switch (aups.length) {
      case 0:
        utils.logWarn('[PPI] No AUP matched for transaction object', to);
        break;
      case 1:
        aup = aups[0];
        lock.add(aup);
        break;
      default:
        utils.logWarn('[PPI] More than one AUP matched, for transaction object. Will take the first one', to, aups);
        aup = aups[0];
        lock.add(aup);
        break;
    }
    result.push({
      transactionObject: to,
      adUnitPattern: aup,
    });
  });

  return result;
}

function findMatchingAUPs(transactionObject, adUnitPatterns) {
  return adUnitPatterns.filter(aup => {
    let match = false;
    switch (transactionObject.type) {
      case TransactionType.SLOT:
        if (aup.slotPattern) {
          match = aup.slotPatternRegex.test(transactionObject.value);
        }
        break;
      case TransactionType.DIV:
        if (aup.divPattern) {
          match = aup.divPatternRegex.test(transactionObject.value);
        }
        break;
      case TransactionType.SLOT_OBJECT:
        match = true;
        if (aup.slotPattern) {
          match = aup.slotPatternRegex.test(transactionObject.value.getAdUnitPath());
        }
        if (aup.divPattern) {
          match = match && aup.divPatternRegex.test(transactionObject.value.getSlotElementId());
        }
        break;
      default:
        // this should never happen, if transaction object passed validation
        utils.logError('[PPI] Invalid transaction object type', transactionObject.type);
        return false;
    }

    if (!match) {
      return false;
    }

    let limitSizes = findLimitSizes(aup, transactionObject);
    // check if sizes are matching
    let aupSizes = utils.deepAccess(aup, 'mediaTypes.banner.sizes');
    // empty limitSizes ([]) means you want to exclude sizes and skip this aup
    if (!limitSizes || !aupSizes || !aupSizes.length) {
      match = true;
    } else {
      let matchingSizes = filterSizesByIntersection(aupSizes, limitSizes);
      match = !!matchingSizes.length;
    }

    if (!match) {
      return false;
    }

    // check if custom mapping function approves
    if (customMappingFunction) {
      return customMappingFunction(transactionObject, aup);
    }

    return true;
  });
}

export function createAdUnit(adUnitPattern, transactionObject) {
  let limitSizes = findLimitSizes(adUnitPattern, transactionObject);
  let adUnit;
  try {
    // copy pattern for conversion into adUnit
    adUnit = JSON.parse(JSON.stringify(adUnitPattern));

    if (limitSizes && limitSizes.length) {
      let sizes = utils.deepAccess(adUnit, 'mediaTypes.banner.sizes')
      if (sizes && sizes.length) {
        sizes = filterSizesByIntersection(sizes, limitSizes);
      } else {
        sizes = limitSizes;
      }

      utils.deepSetValue(adUnit, 'mediaTypes.banner.sizes', sortSizes(sizes));
    }

    // if aup code was not published, generate one
    if (!adUnit.code) {
      // it's important that correct (and sorted) sizes enter the hash function
      adUnit.code = hashFnv32a(JSON.stringify(adUnit)).toString(16);
    }

    // Remove pattern properties not included in adUnit
    delete adUnit.slotPattern;
    delete adUnit.divPattern;
    delete adUnit.slotPatternRegex;
    delete adUnit.divPatternRegex;

    // attach transactionId
    if (!adUnit.transactionId) {
      adUnit.transactionId = utils.generateUUID();
    }
  } catch (e) {
    utils.logError('[PPI] error parsing adUnit', e);
  }

  return adUnit;
}

function findLimitSizes(aup, transactionObject) {
  let divId = utils.deepAccess(transactionObject, 'hbDestination.values.div');
  let gptSizes;
  switch (transactionObject.type) {
    case TransactionType.SLOT:
    case TransactionType.DIV:
      divId = divId || aup.divPattern;
      break;
    case TransactionType.SLOT_OBJECT:
      divId = divId || transactionObject.value.getSlotElementId();
      gptSizes = getGptSlotSizes(transactionObject.value);
      break;
    default:
      utils.logError('[PPI] Invalid transaction object type', transactionObject.type);
      return;
  }

  let sizeMappingSizes = getSizeMappingSizes(divId, getViewport());
  let limitSizes;
  switch (true) {
    // added & transactionObject.sizes.length in case there are pubs passing []
    case !!(transactionObject.sizes && transactionObject.sizes.length):
      limitSizes = transactionObject.sizes;
      break;
    // undefined means no size mapping found, while [] means there is "empty" size mapping
    case !!sizeMappingSizes:
      limitSizes = sizeMappingSizes;
      break;
    case !!gptSizes:
      limitSizes = gptSizes;
      break;
  }

  return limitSizes;
}

export function applyFirstPartyData(adUnit, adUnitPattern, transactionObject) {
  if (transactionObject.targeting) {
    adUnit.fpd = transactionObject.targeting;
  }

  let slotName = getGPTSlotName(transactionObject, adUnitPattern);
  if (!slotName) {
    return;
  }

  utils.deepSetValue(adUnit, 'fpd.context.pbAdSlot', slotName);
  utils.deepSetValue(adUnit, 'fpd.context.adServer', {
    name: 'gam',
    adSlot: slotName
  });
}

/**
 * enable submodule in PPI
 * @param {Submodule} submodule
 */
export function attachSubmodule(submodule) {
  switch (submodule.type) {
    case ModuleType.HBInventory:
      inventoryRegistry[submodule.name] = submodule;
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

(getGlobal()).ppi = {
  requestBids,
  addAdUnitPatterns,
  adUnitPatterns,
  setCustomMappingFunction,
  addSizeMappings,
};

module('ppi', attachSubmodule);
