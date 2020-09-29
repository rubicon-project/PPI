import * as utils from '../../../src/utils.js';
import { submodule } from '../../src/hook.js';

/** @type {Submodule} */
export const aupDivIDSubmodule = {
  type: 'hbInventory',
  name: 'AUPDivID',

  createAdUnit(transactionObject) {
    // TODO: return ad unit if aup was matched
    return {};
  },
};

submodule('ppi', aupDivIDSubmodule);
