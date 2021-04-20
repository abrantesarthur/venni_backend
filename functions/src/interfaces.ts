import { ZoneName } from "./zones";

/******************************************************
 * TRIP
 ******************************************************/
export enum TripStatus {
  waitingConfirmation = "waiting-confirmation",
  waitingPayment = "waiting-payment",
  waitingDriver = "waiting-driver",
  lookingForDriver = "looking-for-driver",
  noDriversAvailable = "no-drivers-available",
  inProgress = "in-progress",
  completed = "completed",
  cancelledByDriver = "cancelled-by-driver",
  cancelledByClient = "cancelled-by-client",
  paymentFailed = "payment-failed",
}

export interface RequestTripInterface {
  origin_place_id: string;
  destination_place_id: string;
}

/**
 * TODO: add payment_method
 * TODO: add card_id
 *  * TODO: update its use to have these fields as well

 */
export interface TripInterface {
  uid: string;
  trip_status: TripStatus;
  origin_place_id: string;
  destination_place_id: string;
  origin_zone: ZoneName;
  fare_price: string;
  distance_meters: string;
  distance_text: string;
  duration_seconds: string;
  duration_text: string;
  encoded_points: string;
  request_time: number; // number of milliseconds since 01/01/1970
  driver_id?: string;
  origin_address: string;
  destination_address: string;
}

/******************************************************
 * PILOT
 ******************************************************/

export enum PilotStatus {
  available = "available",
  offline = "offline", // logged out or without internet
  unavailable = "unavailable",
  busy = "busy",
  requested = "requested",
}

export interface VehicleInterface {
  brand: string;
  model: string;
  year: number;
  plate: string;
}

export const isVehicleInterface = (obj: any): obj is VehicleInterface => {
  return "brand" in obj && "model" in obj && "year" in obj && "plate" in obj;
};

export interface PilotInterface {
  uid: string;
  name: string;
  last_name: string;
  total_trips: number;
  member_since: number;
  phone_number: string;
  current_client_uid?: string;
  current_latitude: number;
  current_longitude: number;
  current_zone: ZoneName;
  status: PilotStatus;
  vehicle: VehicleInterface;
  idle_since: number;
  rating: number;
  score?: number; // not stored in database
  // TODO: change name to route or somethign
  distance_to_client?: DistanceToClient; // not stored in database
}

export interface DistanceToClient {
  distance_text: string;
  distance_value: number;
  duration_text: string;
  duration_value: number;
}

export const isPilotInterface = (obj: any): obj is PilotInterface => {
  if ("vehicle" in obj) {
    if (!isVehicleInterface(obj.vehicle)) {
      return false;
    }
  } else {
    return false;
  }

  return (
    "uid" in obj &&
    "name" in obj &&
    "last_name" in obj &&
    "total_trips" in obj &&
    "member_since" in obj &&
    "phone_number" in obj &&
    "current_latitude" in obj &&
    "current_longitude" in obj &&
    "current_zone" in obj &&
    "status" in obj &&
    "vehicle" in obj &&
    "idle_since" in obj &&
    "rating" in obj
  );
};

// transform an object of pilots in an array of pilots
export const pilotsFromObj = (obj: any): PilotInterface[] => {
  let pilots: PilotInterface[] = [];
  Object.keys(obj).forEach((pilotUID) => {
    // don't add obj to list if it doesn't conform to PilotInterface
    if (isPilotInterface(obj[pilotUID])) {
      // create pilot obj, ignoring eventual extra irrelevant fields
      const pilot = {
        uid: obj[pilotUID].uid,
        name: obj[pilotUID].name,
        last_name: obj[pilotUID].last_name,
        total_trips: obj[pilotUID].total_trips,
        member_since: obj[pilotUID].member_since,
        phone_number: obj[pilotUID].phone_number,
        current_client_uid: obj[pilotUID].current_client_uid,
        current_latitude: obj[pilotUID].current_latitude,
        current_longitude: obj[pilotUID].current_longitude,
        current_zone: obj[pilotUID].current_zone,
        status: obj[pilotUID].status,
        vehicle: obj[pilotUID].vehicle,
        idle_since: obj[pilotUID].idle_since,
        rating: obj[pilotUID].rating,
        score: obj[pilotUID].score,
      };
      pilots.push(pilot);
    }
  });
  return pilots;
};

/******************************************************
 * TRIP
 ******************************************************/

export enum UserPaymentMethod {
  cash = "cash",
  card = "card",
}

export interface ClientInterface {
  past_trips?: TripInterface[];
  total_trips: number;
  total_rating: number;
  rating: number;
}
