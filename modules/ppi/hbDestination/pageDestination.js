import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';

/** @type {Submodule} */
export const pageDestinationSubmodule = {
  name: 'page',

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
      let targetDiv = matchObj.transactionObject.hbDestination.values.div;
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
