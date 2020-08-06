import { getGlobal } from '../../src/prebidGlobal.js';

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
      gptSlotsToRefresh.push(divIdSlotMapping[getDivId(destObj.transactionObject)]);
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

function getDivIdGPTSlotMapping() {
  let mappings = {};
  window.googletag.pubads().getSlots().forEach(slot => {
    mappings[slot.getSlotElementId()] = slot;
  });

  return mappings;
}

function getDivId(transactionObject) {
  switch (transactionObject.type) {
    case 'gptSlotObject':
      return transactionObject.name.getSlotElementId();
    default:
      return transactionObject.hbDestination.values.div;
  }
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
