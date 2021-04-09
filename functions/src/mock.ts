import * as firebaseAdmin from "firebase-admin";
import * as uuid from "uuid";
import { VehicleInterface } from "./trip";
import { LatLimit, LngLimit, Zone } from "./zones";

// returns a random latitude between LatLimit.highest and LatLimit.ninthHighest
const getRandomLatitude = () => {
  return (
    Math.floor(
      (Math.random() * (LatLimit.highest - LatLimit.ninthHighest) +
        LatLimit.ninthHighest) *
        1000000
    ) / 1000000
  );
};

// returns a random latitude between LngLimit.highest and LngLimit.seventhHighest
const getRandomLongitude = () => {
  return (
    Math.floor(
      (Math.random() * (LngLimit.highest - LngLimit.seventhHighest) +
        LngLimit.seventhHighest) *
        1000000
    ) / 1000000
  );
};

export const createMockPilots = async (amount: number) => {
  const db = firebaseAdmin.database();
  let defaultVehicle: VehicleInterface = {
    brand: "honda",
    model: "CG-150",
    year: 2020,
    plate: "PTU-2021",
  };
  let now = Date.now();
  // create 'amount' pilots
  for (var i = 0; i < amount; i++) {
    let pilot = {
      uid: uuid.v4(),
      current_client_id: "",
      current_latitude: getRandomLatitude(),
      current_longitude: getRandomLongitude(),
      status: "available",
      vehicles: [defaultVehicle],
      idle_since: now,
      rating: 4.9,
      current_zone: "",
    };

    let current_zone: Zone = new Zone({
      lat: pilot.current_latitude,
      lng: pilot.current_longitude,
    });
    pilot.current_zone = current_zone.name;
    db.ref("pilots").child(pilot.uid).set(pilot);
  }
};
