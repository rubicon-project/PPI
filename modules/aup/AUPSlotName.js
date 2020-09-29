import * as utils from '../../../src/utils.js';
import { submodule } from '../../src/hook.js';

/** @type {Submodule} */
export const aupSlotNameSubmodule = {
  type: 'hbInventory',
  name: 'AUPSlotName',

  createAdUnit(transactionObject) {
    // TODO: return ad unit if aup was matched
    return {};
  },
};

submodule('ppi', aupSlotNameSubmodule);
