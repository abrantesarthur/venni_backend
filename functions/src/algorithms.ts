import { Partner } from "./database/partner";

// calculateFare uses trip distance to calculate fare price in cents
// TODO: test the fucking shit out of this
export function calculateFare(
  distanceMeters: number,
  durationSeconds: number,
  defaultPaymentMethod: "cash" | "credit_card"
): number {
  let minimumPrice = 500;
  let basePrice = 250;

  let pricePerKm;
  let pricePerMinute;
  if (distanceMeters < 2000) {
    // less than 2km
    pricePerKm = 110;
  } else if (distanceMeters < 3000) {
    // between 2km and 3km
    pricePerKm = 100;
  } else if (distanceMeters < 6000) {
    // between 3km and 6km is the cheapest
    pricePerKm = 95;
  } else if (distanceMeters < 10000) {
    // between 3km and 6km is more expensive
    // this is probably going to be a trip to out of town
    // so partner will spend more idle time coming back
    pricePerKm = 120;
  } else {
    // more than 10km is the most expensive. This is definitely
    // out of town and must be worth the partner's while
    pricePerKm = 180;
  }

  // the longer the trip, the more expensive it is per minute
  if (durationSeconds < 360) {
    // less than 6 minutes. More expensive to account for pushing
    // partner to the end of the line for such a cheap trip
    pricePerMinute = 26;
  } else if (durationSeconds < 600) {
    // between 2 and 10 minutes
    pricePerMinute = 21;
  } else {
    // more than 10 minutes
    pricePerMinute = 19;
  }

  let finalPrice = Math.round(
    basePrice +
      pricePerKm * (distanceMeters / 1000) +
      pricePerMinute * (durationSeconds / 60)
  );

  // if defaultPaymentMethod is 'cash', round the final price
  if (defaultPaymentMethod == "cash") {
    finalPrice = roundToMultipleOfFifty(finalPrice);
  }

  return finalPrice < minimumPrice ? minimumPrice : finalPrice;
}

// roundToMultipleOfFifty rounds 'priceInCents' to its closest multiple of 50.
// for example, if priceInCents = 578, the function returns 600, but if its
// 574, it returns 550.
export function roundToMultipleOfFifty(priceInCents: number): number {
  let remainder = priceInCents % 100;
  let delta =
    remainder < 25
      ? -remainder
      : remainder < 75
      ? 50 - remainder
      : 100 - remainder;
  return priceInCents + delta;
}

export enum Demand {
  low = "low",
  medium = "medium",
  high = "high",
  veryHigh = "very_high",
}

// calculateDemandScore uses 'tripRequestCount' and 'availablePartnersCount' to
// calculate a demand score.

// take into account the size of the zones
export const calculateDemand = (
  tripRequestCount: number,
  availablePartnersCount: number
): Demand => {
  if (availablePartnersCount <= 1) {
    return tripRequestCount <= 5 // ~1 request per partner per minute
      ? Demand.low
      : tripRequestCount <= 7 // ~1.5 requests per partner per minute
      ? Demand.medium
      : tripRequestCount <= 10 // ~2 requests per partner per minute
      ? Demand.high
      : Demand.veryHigh; // 2 or more requests per partner per minute
  }

  let requestsPerPartner = tripRequestCount / availablePartnersCount;
  let requestsPerPartnerPerMinute = requestsPerPartner / 5;

  return requestsPerPartnerPerMinute <= 1
    ? Demand.low
    : requestsPerPartnerPerMinute <= 1.5
    ? Demand.medium
    : requestsPerPartnerPerMinute <= 2
    ? Demand.high
    : Demand.veryHigh;
};

// rank partners according to distance from client, time spent idle, and rating
export const rankPartners = (
  partners: Partner.Interface[]
): Partner.Interface[] => {
  // calculate each partner's score
  const now = Date.now();
  partners.forEach((partner) => {
    let partnerIdleSeconds = (now - Number(partner.idle_since)) / 1000;
    partner.score = calculatePartnerScore(
      partnerIdleSeconds,
      Number(partner.rating),
      partner.distance_to_client?.distance_value
    );
  });

  // sort partners by score
  let rankedPartners = partners.sort((partnerOne, partnerTwo) => {
    if (partnerOne.score != undefined && partnerTwo.score != undefined) {
      return partnerTwo.score - partnerOne.score;
    }
    return 0;
  });

  return rankedPartners;
};

export const calculatePartnerScore = (
  idleSeconds: number,
  rating: number,
  distance?: number
): number => {
  return (
    distanceScore(distance) + idleTimeScore(idleSeconds) + ratingScore(rating)
  );
};

// calculateDistanceScores returns 50 points for partners no farther
// than 100 meters, 0 points for partners farther than 4999 meters,
// and lineraly decrements points for partners in between.
export const distanceScore = (distanceMeters?: number) => {
  if (distanceMeters == undefined) {
    return 0;
  }
  if (distanceMeters <= 100) {
    return 50;
  }
  if (distanceMeters > 4999) {
    return 0;
  }
  return (5000 - distanceMeters) / 98;
};

// IdleTimeScore linearly and indefinitely increments partner score
// such that partners idle for 0 seconds receive 0 points and partners idle for
// 5 minutes receive 40 points. Time idle can potentially give unlimited points.
// This way, no matter a partner's distance and score, at some point they will receive a ride.
export const idleTimeScore = (timeSeconds: number) => {
  return (timeSeconds * 4) / 30;
};

// RatingScore such that partners with less than 3 starts receive 0
// points and those with 5 starts receive 10 points, and those in between
// receive incrementally more points the higher their ratings.
export const ratingScore = (rating: number) => {
  if (rating < 3) {
    return 0;
  }
  if (rating > 5) {
    return 10;
  }
  return 5 * rating - 15;
};
