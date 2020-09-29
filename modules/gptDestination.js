import { getGlobal } from '../src/prebidGlobal.js';
import * as utils from '../src/utils.js';
import { submodule } from '../src/hook.js';

window.googletag = window.googletag || {};
window.googletag.cmd = window.googletag.cmd || [];

/** @type {Submodule} */
export const gptDestinationSubmodule = {
  type: 'hbDestination',
  name: 'gpt',

  send(destinationObjects) {
    window.googletag.cmd.push(() => {
      let divIdSlotMapping = getDivIdGPTSlotMapping();
      let gptSlotsToRefresh = [];
      let adUnitCodes = [];
      let mappings = {};
      destinationObjects.forEach(destObj => {
        let divId = getDivId(destObj.transactionObject);
        if (!divId) {
          utils.logError('[PPI] GPT Destination Module: unable to find target div id for transaction object: ', destObj.transactionObject);
          return;
        }

        let slotId = getSlotId(destObj.transactionObject, divIdSlotMapping);
        if (!slotId) {
          utils.logError('[PPI] GPT Destination Module: unable to find slot id for transaction object: ', destObj.transactionObject);
          return;
        }

        let adUnitSizes = [];
        if (destObj.adUnit) {
          adUnitSizes = utils.deepAccess(destObj.adUnit, 'mediaTypes.banner.sizes');
        }

        // existing gpt slot
        let gptSlot = divIdSlotMapping[divId];
        if (!gptSlot) {
          gptSlot = createGPTSlot(slotId, adUnitSizes, divId);
        } else if (destObj.transactionObject.match.status) {
          validateExistingSlot(gptSlot, slotId, adUnitSizes, divId);
        }

        // create gpt slot failed
        if (!gptSlot) {
          return;
        }

        gptSlotsToRefresh.push(gptSlot);
        if (!destObj.adUnit) {
          return;
        }
        let code = destObj.adUnit.code;
        adUnitCodes.push(code);

        mappings[code] = divId;
      });
      setTargeting(adUnitCodes, mappings);
      window.googletag.pubads().refresh(gptSlotsToRefresh);
    });
  },
};

function createGPTSlot(slotId, sizes, divId) {
  let slot;
  try {
    slot = window.googletag.defineSlot(slotId, sizes, divId);
    slot.addService(window.googletag.pubads());
    window.googletag.display(slot);
  } catch (e) {
    utils.logError('[PPI] while creating GTP slot:', e);
  }

  return slot;
}

function validateExistingSlot(gptSlot, slotId, adUnitSizes, divId) {
  if (gptSlot.getAdUnitPath() !== slotId) {
    utils.logError(`[PPI] target div '${divId}' contains slot with ad unit path '${gptSlot.getAdUnitPath()}', expected ${slotId}`);
  }

  let gptSlotSizes = gptSlot.getSizes();
  gptSlotSizes = gptSlotSizes.filter(gptSlotSize => typeof gptSlotSize.getHeight === 'function' && typeof gptSlotSize.getWidth === 'function')
    .map(gptSlotSize => `${gptSlotSize.getWidth()}x${gptSlotSize.getHeight()}`);

  adUnitSizes = adUnitSizes.map(size => `${size[0]}x${size[1]}`)

  let difference = (listA, listB) => {
    let diff = new Set(listA)
    for (let elem of listB) {
      diff.delete(elem)
    }
    return diff
  }

  let extraGPTSizes = difference(gptSlotSizes, adUnitSizes);
  let extraAdUnitSizes = difference(adUnitSizes, gptSlotSizes);

  extraGPTSizes = Array.from(extraGPTSizes).join(' ');
  extraAdUnitSizes = Array.from(extraAdUnitSizes).join(' ');

  if (extraGPTSizes || extraAdUnitSizes) {
    utils.logError(`[PPI] target div '${divId}' contains slot with incompatible sizes, extra GPT sizes: ${extraGPTSizes}, extra Ad Unit sizes: ${extraAdUnitSizes}`);
  }
}

function getDivIdGPTSlotMapping() {
  let mappings = {};
  window.googletag.pubads().getSlots().forEach(slot => {
    mappings[slot.getSlotElementId()] = slot;
  });

  return mappings;
}

function getDivId(transactionObject) {
  if (transactionObject.hbDestination.values && transactionObject.hbDestination.values.div) {
    return transactionObject.hbDestination.values.div;
  }

  if (transactionObject.type === TransactionType.SLOT_OBJECT) {
    return transactionObject.value.getSlotElementId();
  }

  if (!transactionObject.match.status) {
    return '';
  }

  let div = transactionObject.match.aup.divPattern;
  // TODO: check if .*^$ are valid regex markers
  let isRegex = ['.', '*', '^', '$'].some(p => div.indexOf(p) !== -1);
  return isRegex ? '' : div;
}

function getSlotId(transactionObject, divIdSlotMapping) {
  switch (transactionObject.type) {
    case TransactionType.SLOT:
      return transactionObject.value;
    case TransactionType.SLOT_OBJECT:
      return transactionObject.value.getAdUnitPath();
    case TransactionType.DIV:
      let aup = transactionObject.match.status && transactionObject.match.aup;
      if (aup && aup.slotPattern) {
        // TODO: check if .*^$ are valid regex markers
        let isRegex = ['.', '*', '^', '$'].some(p => aup.slotPattern.indexOf(p) !== -1);
        if (!isRegex) {
          return aup.slotPattern;
        }
      }

      let existingSlot = divIdSlotMapping[transactionObject.value];
      return existingSlot ? existingSlot.getAdUnitPath() : '';
  }

  return '';
}

/**
 * Sets slot targeting for provided adUnits.
 * Which targeting should be set on which slot is calculated based on provided mappings.
 * @param {(string[])} adUnitCodes array of adUnit codes to refresh.
 * @param {function(object)} callback called when HB auction ends and bids are retrieved.
 */
function setTargeting(adUnitCodes, mappings) {
  getGlobal().setTargetingForGPTAsync(adUnitCodes, (slot) => {
    let id = slot.getSlotElementId();
    return (adUnitCode) => {
      return mappings[adUnitCode] === id;
    }
  });
}

// TODO: remove
export const TransactionType = {
  SLOT: 'slot',
  DIV: 'div',
  SLOT_OBJECT: 'slotObject',
  AUTO_SLOTS: 'autoSlots',
};

submodule('ppi', gptDestinationSubmodule);
