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
  canceled = "canceled",
  paymentFailed = "payment-failed",
  timedOutWaitingDriverAcceptance = "timed-out-waiting-driver-acceptance",
}

export interface RequestTripInterface {
  origin_place_id: string;
  destination_place_id: string;
}

/**
 * TODO: add payment_method
 * TODO: add used_card_number
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

// TODO: verify vehicles if it's an array
export interface PilotInterface {
  uid: string;
  current_client_uid?: string;
  current_latitude: number;
  current_longitude: number;
  current_zone: ZoneName;
  status: PilotStatus;
  vehicles: Array<VehicleInterface>;
  idle_since: number;
  rating: number;
  score: number;
  position: PilotPosition;
}

export interface PilotPosition {
  distance_text: string;
  distance_value: number;
  duration_text: string;
  duration_value: number;
}

/******************************************************
 * TRIP
 ******************************************************/

export enum UserPaymentMethod {
  cash = "cash",
  card = "card",
}

export interface UserPastTrip {
  request_time: number; // is also the key
  departure_time: number;
  arrival_time: number;
  finish_status: TripStatus;
  origin_place_id: string;
  destination_place_id: string;
  distance_value: number;
  ride_fare: number;
  payment_method: UserPaymentMethod;
  used_card_id?: string;
}

export interface UserInterface {
  past_trips: Array<UserPastTrip>;
}
