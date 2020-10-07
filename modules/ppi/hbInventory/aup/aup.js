import { getGlobal } from '../../../../src/prebidGlobal.js';
import * as utils from '../../../../src/utils.js';
import { TransactionType } from './consts.js';
import { findLimitSizes, filterSizesByIntersection, isSizeValid, sortSizes, findAUPSizes } from './sizes.js';
import { hashFnv32a, isRegex } from './utils.js';

export const aupInventorySubmodule = {
  name: 'AUP',

  createAdUnits,
  isValid,
  getTransactionTypes() {
    return Object.keys(TransactionType).map(t => TransactionType[t]);
  }
};

// used to track if aup matching was called before setCustomMappingFunction
let aupsMatched = false;
export function createAdUnits(transactionObjects) {
  aupsMatched = true;
  let matches = [];
  let allTOs = [];

  // transform autoslots
  transactionObjects.forEach(to => {
    if (to.hbInventory.type !== TransactionType.AUTO_SLOTS) {
      allTOs.push(to);
      return;
    }
    allTOs = allTOs.concat(transformAutoSlots(to));
  });

  let toAUPPair = matchAUPs(allTOs, adUnitPatterns);
  toAUPPair.forEach(toAUP => {
    let aup = toAUP.adUnitPattern;
    let to = toAUP.transactionObject;
    let au;
    if (aup) {
      au = createAdUnit(aup, to);
      applyFirstPartyData(au, aup, to);
    }

    to.divId = getDivId(to, aup);
    to.slotName = getSlotName(to, aup);

    matches.push({
      transactionObject: to,
      adUnit: au,
    });
  });

  return matches;
}

export function isValid(transactionObject) {
  switch (transactionObject.hbInventory.type) {
    case TransactionType.SLOT:
    case TransactionType.DIV:
      // TODO: maybe also check && !isRegex()
      return utils.isStr(utils.deepAccess(transactionObject, 'hbInventory.values.name'));
    case TransactionType.SLOT_OBJECT:
      return utils.isPlainObject(utils.deepAccess(transactionObject, 'hbInventory.values.slot'));
  }
  return true;
}

export function createAdUnit(adUnitPattern, transactionObject) {
  // TODO: will it hurt PBJS if 'fluid' gets into ad unit MTO sizes?
  let limitSizes = findLimitSizes(transactionObject);
  let aupSizes = findAUPSizes(adUnitPattern);
  let adUnit;
  try {
    // copy pattern for conversion into adUnit
    adUnit = JSON.parse(JSON.stringify(adUnitPattern));

    if (limitSizes && limitSizes.length) {
      if (!aupSizes || !aupSizes.length ||
        transactionObject.hbInventory.type === TransactionType.SLOT ||
        transactionObject.hbInventory.type === TransactionType.DIV) {
        // this is the size override
        aupSizes = limitSizes;
      } else {
        aupSizes = filterSizesByIntersection(aupSizes, limitSizes);
      }
    }
    utils.deepSetValue(adUnit, 'mediaTypes.banner.sizes', sortSizes(aupSizes));

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
  } catch (e) {
    utils.logError('[PPI] error parsing adUnit', e);
  }

  return adUnit;
}

export function matchAUPs(transactionObjects, adUnitPatterns) {
  let matches = [];
  let lock = new Set();
  transactionObjects.forEach(to => {
    let aups = findMatchingAUPs(to, adUnitPatterns).filter(a => {
      let isLocked = lock.has(a);
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
    matches.push({
      transactionObject: to,
      adUnitPattern: aup,
    });
  });

  return matches;
}

function findMatchingAUPs(transactionObject, adUnitPatterns) {
  return adUnitPatterns.filter(aup => {
    let match = false;
    switch (transactionObject.hbInventory.type) {
      case TransactionType.SLOT:
        if (aup.slotPattern) {
          match = aup.slotPatternRegex.test(transactionObject.hbInventory.values.name);
        }
        break;
      case TransactionType.DIV:
        if (aup.divPattern) {
          match = aup.divPatternRegex.test(transactionObject.hbInventory.values.name);
        }
        break;
      case TransactionType.SLOT_OBJECT:
        match = true;
        if (aup.slotPattern) {
          match = aup.slotPatternRegex.test(transactionObject.hbInventory.values.slot.getAdUnitPath());
        }
        if (aup.divPattern) {
          match = match && aup.divPatternRegex.test(transactionObject.hbInventory.values.slot.getSlotElementId());
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

    let limitSizes = findLimitSizes(transactionObject);
    let aupSizes = findAUPSizes(aup);
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

function getDivId(transactionObject, adUnitPattern) {
  if (transactionObject.hbInventory.type === TransactionType.SLOT_OBJECT) {
    return transactionObject.hbInventory.values.slot.getSlotElementId();
  }

  if (!adUnitPattern) {
    return '';
  }

  if (transactionObject.hbInventory.type === TransactionType.DIV) {
    return transactionObject.hbInventory.values.name;
  }

  let div = adUnitPattern.divPattern;
  return isRegex(div) ? '' : div;
}

function getSlotName(transactionObject, adUnitPattern) {
  switch (transactionObject.hbInventory.type) {
    case TransactionType.SLOT:
      return transactionObject.hbInventory.values.name;
    case TransactionType.DIV:
      if (adUnitPattern && adUnitPattern.slotPattern && !isRegex(adUnitPattern.slotPattern)) {
        return adUnitPattern.slotPattern;
      }
      break;
    case TransactionType.SLOT_OBJECT:
      return transactionObject.hbInventory.values.slot.getAdUnitPath();
  }

  return '';
}

export function applyFirstPartyData(adUnit, adUnitPattern, transactionObject) {
  if (transactionObject.hbInventory.fpd) {
    adUnit.fpd = transactionObject.hbInventory.fpd;
  }

  let slotName = getSlotName(transactionObject, adUnitPattern);
  if (!slotName) {
    return;
  }

  utils.deepSetValue(adUnit, 'fpd.context.pbAdSlot', slotName);
  utils.deepSetValue(adUnit, 'fpd.context.adServer', {
    name: 'gam',
    adSlot: slotName
  });
}

export function transformAutoSlots(transactionObject) {
  if (!transactionObject) {
    return [];
  }
  let gptSlots = [];
  try {
    gptSlots = window.googletag.pubads().getSlots();
  } catch (e) {
    utils.logError(`[PPI] - could not get all gpt slots: ${e}, is gpt initialized?`);
  }

  if (!gptSlots || !gptSlots.length) {
    return [];
  }

  let slotObjectTOs = [];
  gptSlots.forEach(gptSlot => {
    let slotObjectTO = {
      hbInventory: {
        type: TransactionType.SLOT_OBJECT,
        values: {
          slot: gptSlot,
        },
        fpd: transactionObject.hbInventory.fpd,
      },
      hbSource: transactionObject.hbSource,
      hbDestination: transactionObject.hbDestination,
    };

    slotObjectTOs.push(slotObjectTO);

    utils.logInfo('[PPI] - from autoSlot: ', transactionObject, 'created slot objects: ', slotObjectTOs);
  });

  return slotObjectTOs;
}

/**
 * @param {function} mappingFunction - to map custom params to adUnits.
 *                     function should accept two arguments: to: <transactionObject>, aup: <adUnitPattern>
 *                     function returns true if transaction object matches ad unit pattern, else false
 */
let customMappingFunction;
export function setCustomMappingFunction(mappingFunction) {
  if (aupsMatched) {
    utils.logWarn('[PPI] calling setCustomMappingFunction after requestBids could cause ad serving discrepancies or race conditions.');
  }

  if (!utils.isFn(mappingFunction)) {
    utils.logError('[PPI] custom mapping function must be a function', mappingFunction);
    return;
  }

  customMappingFunction = mappingFunction;
}

export const adUnitPatterns = [];
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

(getGlobal()).ppi = (getGlobal()).ppi || {};
(getGlobal()).ppi.addAdUnitPatterns = addAdUnitPatterns;
(getGlobal()).ppi.setCustomMappingFunction = setCustomMappingFunction;
