import * as utils from '../../../../src/utils.js';
import { TransactionType } from './consts.js';
import find from 'core-js-pure/features/array/find.js';

/**
 * Find sizes for given adUnitPattern
 * @param {{Object}} aup - adUnitPattern
 * @return {(Object[])} array of sizes formatted [[w,h],...]
 */
export function findAUPSizes(aup) {
  let aupSizes = utils.deepAccess(aup, 'mediaTypes.banner.sizes');
  let respSizes = utils.deepAccess(aup, 'mediaTypes.banner.responsiveSizes');
  if (respSizes && respSizes.length) {
    let vpSizes = filterResponsiveSizes(respSizes, getViewport());
    return filterSizesByIntersection(vpSizes, aupSizes);
  }

  return aupSizes;
}

/**
 * Find limit sizes from transactionObject
 * If transaction object is slot object type, get sizes from gpt slot
 * @param {{Object}} transactionObject
 * @return {(Object[])} array of sizes formatted [[w,h],...]
 */
export function findLimitSizes(transactionObject) {
  let toSizes = transactionObject.hbInventory.sizes;
  if (transactionObject.hbInventory.type === TransactionType.SLOT_OBJECT) {
    if (toSizes && toSizes.length) {
      utils.logWarn(`hbInventory.sizes override is not supported for transaction type ${transactionObject.hbInventory.type}`);
    }

    return getGptSlotSizes(transactionObject.hbInventory.values.slot);
  }

  return toSizes;
}

/**
 * Gets the given gpt slot's sizes in an array formatted [[w,h],...],
 *      excluding any "Fluid" sizes (which don't have a width or height
 * @param {googletag.Slot} gptSlot
 * @returns {Array} - gpt slot sizes array formatted [[w,h],...]
 */
function getGptSlotSizes(gptSlot) {
  let viewport = getViewport();
  let gptSlotSizes = gptSlot.getSizes(viewport[0], viewport[1]);
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
 * @param {Object} responsiveSizes array of viewport -> adUnit size mappings where each size is [w, h]
 *     [
 *       {minViewPort: viewportSize1, sizes: [adUnitSize1, adUnitSize2, etc]}
 *       {minViewPort: viewportSize2, sizes: [adUnitSize1, adUnitSize2, etc]}
 *       etc
 *     ]
 * @param {Array} viewport dimensions [width, height]
 * @returns {Array} of available sizes based on current viewport or undefined if no matching viewport found
 */
function filterResponsiveSizes(responsiveSizes, viewport) {
  if (!responsiveSizes) {
    return;
  }

  let sizes;
  try {
    // sort responsiveSizes from biggest to smallest viewport
    // then find the biggest one that fits in the given viewport
    let val = (find(responsiveSizes.sort((a, b) => {
      let aVP = a.minViewPort;
      let bVP = b.minViewPort;
      return bVP[0] * bVP[1] - aVP[0] * aVP[1] || bVP[0] - aVP[0] || bVP[1] - aVP[1];
    }), (responsiveSize) => {
      return viewport[0] >= responsiveSize.minViewPort[0] && viewport[1] >= responsiveSize.minViewPort[1];
    }));
    sizes = val && val.sizes;
  } catch (e) {
    utils.logError('[PPI] while parsing responsiveSizes:', responsiveSizes, e);
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
