// offerService.js — stub for handling offers
export async function createOffer(offer) {
  // offer: { id, userId, cardId, currentPrice, offerPrice, status }
  return offer
}

export async function updateOffer(offerId, patch) {
  return { offerId, ...patch }
}

export async function listOffers() {
  return []
}
