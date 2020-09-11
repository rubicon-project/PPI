import { getGlobal } from '../../../src/prebidGlobal.js';
import * as utils from '../../../src/utils.js';

export function send(destinationObjects) {
  let pbjs = getGlobal();
  destinationObjects.forEach(destObj => {
    let highestBid = pbjs.getHighestCpmBids(destObj.adUnit.code);
    if (!highestBid) {
      utils.logWarn('[PPI] No bid for ad unit code ', destObj.adUnit.code);
      return;
    }
    if (Array.isArray(highestBid)) {
      highestBid = highestBid[0];
    }

    let targetDiv = destObj.transactionObject.hbDestination.values.div;
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
}
