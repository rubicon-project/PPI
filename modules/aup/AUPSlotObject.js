import * as utils from '../../../src/utils.js';
import { submodule } from '../../src/hook.js';

/** @type {Submodule} */
export const aupSlotObjectSubmodule = {
  type: 'hbInventory',
  name: 'AUPSlotObject',

  createAdUnit(transactionObject) {
    // TODO: return ad unit if aup was matched
    return {};
  },
};

submodule('ppi', aupSlotObjectSubmodule);
