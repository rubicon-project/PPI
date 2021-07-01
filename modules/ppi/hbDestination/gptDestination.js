import Set from 'core-js-pure/features/set';
import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';

window.googletag = window.googletag || {};
window.googletag.cmd = window.googletag.cmd || [];

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to refresh gpt slots
 * The submodule will create gpt slots if they are not on the page (not created by the user)
 * To create gpt slots, submodule needs to have required information: adUnitPath, sizes and divId
 * For each transactionObject that has matched adUnit, the submodule will set targeting by calling pbjs.setTargetingForGPTAsync
 * Beside pbjs targeting, user can provide custom targeting for this submodule to set on gpt slots
 * After setting targeting the submodule will refresh gpt slots
*/
export const gptDestinationSubmodule = {
  name: 'gpt',

  /**
   * find appropriate gpt slots, set targeting on them and refresh them
   * if appropriate gpt slot can be found on the page, then create it
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  send(matchObjects) {
    window.googletag.cmd.push(() => {
      let divIdSlotMapping = getDivIdGPTSlotMapping();
      let gptSlotsToRefresh = [];
      let adUnitCodes = [];
      let mappings = {};
      matchObjects.forEach(matchObj => {
        matchObj.transactionObject.hbDestination.values = matchObj.transactionObject.hbDestination.values || {};
        let divId = matchObj.transactionObject.hbDestination.values.div || matchObj.transactionObject.divId;
        if (!divId) {
          utils.logError('[PPI] GPT Destination Module: unable to find target div id for transaction object: ', matchObj.transactionObject);
          return;
        }

        let adUnitPath = matchObj.transactionObject.slotName;

        let adUnitSizes = [];
        let toSizes = utils.deepAccess(matchObj, 'transactionObject.hbInventory.sizes');
        if (Array.isArray(toSizes) && toSizes.length) {
          adUnitSizes = matchObj.transactionObject.hbInventory.sizes;
        } else if (matchObj.adUnit) {
          adUnitSizes = utils.deepAccess(matchObj.adUnit, 'mediaTypes.banner.sizes');
        }

        // existing gpt slot
        let gptSlot = divIdSlotMapping[divId];
        if (!gptSlot) {
          if (!adUnitPath) {
            utils.logError('[PPI] GPT Destination Module: unable to find adUnitPath for transaction object: ', matchObj.transactionObject);
            return;
          }
          gptSlot = createGPTSlot(adUnitPath, adUnitSizes, divId);
        } else if (matchObj.adUnit) {
          validateExistingSlot(gptSlot, adUnitPath, adUnitSizes, divId);
        }

        // create gpt slot failed
        if (!gptSlot) {
          return;
        }

        setCustomTargeting(gptSlot, matchObj.transactionObject.hbDestination.values.targeting);

        gptSlotsToRefresh.push(gptSlot);
        if (!matchObj.adUnit) {
          return;
        }
        let code = matchObj.adUnit.code;
        adUnitCodes.push(code);

        mappings[code] = divId;
      });
      setTargeting(adUnitCodes, mappings);
      window.googletag.pubads().refresh(gptSlotsToRefresh);
    });
  },
};

function createGPTSlot(adUnitPath, sizes, divId) {
  let slot;
  try {
    slot = window.googletag.defineSlot(adUnitPath, sizes, divId);
    slot.addService(window.googletag.pubads());
    window.googletag.display(slot);
  } catch (e) {
    utils.logError('[PPI] while creating GTP slot:', e);
  }

  return slot;
}

function validateExistingSlot(gptSlot, adUnitPath, adUnitSizes, divId) {
  if (adUnitPath && gptSlot.getAdUnitPath() !== adUnitPath) {
    utils.logError(`[PPI] target div '${divId}' contains slot with ad unit path '${gptSlot.getAdUnitPath()}', expected ${adUnitPath}`);
  }

  let gptSlotSizes = gptSlot.getSizes(window.innerWidth, window.innerHeight);
  gptSlotSizes = gptSlotSizes.filter(gptSlotSize => typeof gptSlotSize.getHeight === 'function' && typeof gptSlotSize.getWidth === 'function')
    .map(gptSlotSize => `${gptSlotSize.getWidth()}x${gptSlotSize.getHeight()}`);

  adUnitSizes = adUnitSizes.map(size => `${size[0]}x${size[1]}`);

  let hasDifference = (listA, listB) => {
    let diff = new Set(listA)
    for (let elem of listB) {
      diff.delete(elem)
    }
    return diff.size;
  }

  if (hasDifference(gptSlotSizes, adUnitSizes) || hasDifference(adUnitSizes, gptSlotSizes)) {
    utils.logWarn(`[PPI] target div '${divId}' contains slot that has different sizes than pbjs Ad Unit. Slot sizes: [${gptSlotSizes}], pbjs Ad Unit sizes: [${adUnitSizes}]. Check your pbjs Ad Unit configuration and gpt slot definition.`);
  }
}

function getDivIdGPTSlotMapping() {
  let mappings = {};
  window.googletag.pubads().getSlots().forEach(slot => {
    mappings[slot.getSlotElementId()] = slot;
  });

  return mappings;
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

function setCustomTargeting(gptSlot, targeting) {
  if (!targeting || !gptSlot) {
    return;
  }

  for (let key in targeting) {
    if (!targeting.hasOwnProperty(key)) {
      continue;
    }

    gptSlot.setTargeting(key, targeting[key]);
  }
}
