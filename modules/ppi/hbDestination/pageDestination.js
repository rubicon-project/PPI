import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';

/** @type {Submodule}
 * Responsibility of this submodule is to provide mechanism for ppi to render ads directly on the page without adserver
 * This submodule will get the ad from the highest bid, it will create iframe and it will call pbjs.renderAd to render the ad
*/
export const pageDestinationSubmodule = {
  name: 'page',

  /**
   * send results to the page, for each matched adUnit: get highest bid, create iframe and render ad
   * @param {(Object[])} matchObjects array of transactionObjects and matched adUnits
   * @param {function} callback
   */
  send(matchObjects) {
    let pbjs = getGlobal();
    matchObjects.forEach(matchObj => {
      if (!matchObj.adUnit) {
        utils.logWarn('[PPI] adUnit not created for transaction object ', matchObj.transactionObject);
        return;
      }
      let highestBid = pbjs.getHighestCpmBids(matchObj.adUnit.code);
      if (Array.isArray(highestBid)) {
        highestBid = highestBid[0];
      }
      if (!highestBid) {
        utils.logWarn('[PPI] No bid for ad unit code ', matchObj.adUnit.code);
        return;
      }
      let targetDiv = utils.deepAccess(matchObj, 'transactionObject.hbDestination.values.div') || matchObj.transactionObject.divId;
      let targetEl = document.getElementById(targetDiv);
      if (!targetEl) {
        utils.logError('[PPI] Div element not found ', targetDiv);
        return;
      }

      let iframe = utils.createInvisibleIframe();
      iframe.height = highestBid.height;
      iframe.width = highestBid.width;
      iframe.style.display = 'inline';
      iframe.style.overflow = 'hidden';

      targetEl.appendChild(iframe);
      pbjs.renderAd(iframe.contentWindow.document, highestBid.adId);
    });
  },
};
