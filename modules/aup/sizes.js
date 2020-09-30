import * as utils from '../../src/utils.js';
import { TransactionType } from './consts.js';
import { getGlobal } from '../../src/prebidGlobal.js';
import { isRegex } from './utils.js';

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

export function findLimitSizes(aup, transactionObject) {
  let divId = utils.deepAccess(transactionObject, 'hbDestination.values.div');
  let gptSizes;
  switch (transactionObject.hbInventory.type) {
    case TransactionType.SLOT:
    case TransactionType.DIV:
      divId = divId || aup.divPattern;
      break;
    case TransactionType.SLOT_OBJECT:
      let slot = transactionObject.hbInventory.values.slot;
      divId = divId || slot.getSlotElementId();
      gptSizes = getGptSlotSizes(slot);
      break;
    default:
      utils.logError('[PPI] Invalid transaction object type', transactionObject.hbInventory.type);
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

function getSizeMappingSizes(divId, viewport) {
  let sizeMappings = getGlobal().ppi.sizeMappings;
  if (!sizeMappings) {
    return;
  }

  if (isRegex(divId)) {
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

// sortSizes in place, descending, by area, width, height
export function sortSizes(sizes) {
  return sizes.sort((a, b) => {
    return b[0] * b[1] - a[0] * a[1] || b[0] - b[0] || a[1] - a[1];
  });
}

/**
 * @param {Array.<Array>} currentSizes
 * @param {Array.<Array>} allowedSizes
 * @returns {Array.<Array>}
 */
export function filterSizesByIntersection(currentSizes, allowedSizes) {
  return currentSizes.filter(function (size) {
    return hasValidSize(size, allowedSizes);
  });
}

export function isSizeValid(size) {
  return Array.isArray(size) && size.length === 2 && typeof (size[0]) === 'number' && typeof (size[1]) === 'number';
}

/**
 * // get current viewport
 * @returns {Array} viewport size [w, h]
 */
export function getViewport() {
  return [window.innerWidth, window.innerHeight];
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
