
import { getGlobal } from '../../src/prebidGlobal.js';

/**
 * @param {(Object[])} transactionObjects array of adUnit codes to refresh.
 */
export function requestBids(transactionObjects) {
}

(getGlobal()).ppi = {
  refreshBids: requestBids,
};
