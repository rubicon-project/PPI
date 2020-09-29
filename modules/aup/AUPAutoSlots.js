import * as utils from '../../../src/utils.js';
import { submodule } from '../../src/hook.js';

/** @type {Submodule} */
export const aupAutoSlotsSubmodule = {
  type: 'hbInventory',
  name: 'AUPAutoSlots',

  createAdUnit(transactionObject) {
    // TODO: return ad unit if aup was matched
    return {};
  },
};

submodule('ppi', aupAutoSlotsSubmodule);
