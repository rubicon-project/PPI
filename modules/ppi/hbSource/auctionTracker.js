/**
 * This object holds all the latest auction information for each adUnit
 */
export const auctionTracker = {
  // adUnitCode -> {bids, timedOut, auctionId}
  latestAuctionForAdUnit: {},

  setLatestAuction(adUnitCode, bids, timedOut, auctionId) {
    this.latestAuctionForAdUnit[adUnitCode] = {
      bids: bids,
      timedOut: timedOut,
      auctionId,
    };
  },

  getLatestAuction(adUnitCode) {
    return this.latestAuctionForAdUnit[adUnitCode];
  }
};
