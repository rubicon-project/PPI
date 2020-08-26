import { getGlobal } from '../../src/prebidGlobal.js';
import { TransactionType } from './consts.js';
import * as utils from '../../src/utils.js';

window.googletag = window.googletag || {};
let googletag = window.googletag;
googletag.cmd = googletag.cmd || [];

export function send(destinationObjects) {
  googletag.cmd.push(() => {
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

      let slotId = getSlotId(destObj.transactionObject);
      if (!slotId) {
        utils.logError('[PPI] GPT Destination Module: unable to find slot id for transaction object: ', destObj.transactionObject);
        return;
      }

      let adUnitSizes = [];
      if (destObj.transactionObject.adUnit) {
        adUnitSizes = utils.deepAccess(destObj.transactionObject.adUnit, 'mediaTypes.banner.sizes');
      }

      // existing gpt slot
      let gptSlot = divIdSlotMapping[divId];
      if (!gptSlot) {
        gptSlot = createGPTSlot(slotId, adUnitSizes, divId);
      }

      // TODO:
      // else {
      //   // check if sizes match
      //   // check if slotId's match
      //   // if they do, reuse the slot
      //   // if they don't, destroy the existing slot and create a new one with adUnit.....sizes
      // }

      gptSlotsToRefresh.push(gptSlot);
      if (!destObj.adUnit) {
        return;
      }
      let code = destObj.adUnit.code;
      adUnitCodes.push(code);

      mappings[code] = divId;
    });
    setTargeting(adUnitCodes, mappings);
    googletag.pubads().refresh(gptSlotsToRefresh);
  });
}

function createGPTSlot(slotId, sizes, divId) {
  // TODO: wrap with try catch
  let slot = googletag.defineSlot(slotId, sizes, divId).addService(googletag.pubads());
  googletag.display(slot);
  return slot;
}

function getDivIdGPTSlotMapping() {
  let mappings = {};
  window.googletag.pubads().getSlots().forEach(slot => {
    mappings[slot.getSlotElementId()] = slot;
  });

  return mappings;
}

function getDivId(transactionObject) {
  if (transactionObject.hbDestination.values.div) {
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

function getSlotId(transactionObject) {
  switch (transactionObject.type) {
    case TransactionType.SLOT:
      return transactionObject.value;
    case TransactionType.SLOT_OBJECT:
      return transactionObject.value.getAdUnitPath();
    case TransactionType.DIV:
      let aup = transactionObject.match.status && transactionObject.match.aup;
      if (!aup) {
        return '';
      }

      // TODO: check if .*^$ are valid regex markers
      let isRegex = ['.', '*', '^', '$'].some(p => aup.slotPattern.indexOf(p) !== -1);
      return isRegex ? '' : aup.slotPattern;
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
