const chai = require("chai");
const assert = chai.assert;

describe("pilosFromObj", () => {
  let p;
  before(() => {
    p = require("../lib/pilots");
  });

  it("outputs PilotInterface list when parameters are valid", () => {
    const obj = {
      first_pilot_uid: {
        uid: "first_pilot_uid",
        current_client_uid: "",
        current_latitude: 10.123456,
        current_longitude: 11.123456,
        current_zone: "AA",
        status: "available",
        vehicles: [
          {
            brand: "honda",
            model: "cg-150",
            year: 2015,
            plate: "AAA-0000",
          },
        ],
        idle_since: Date.now(),
        rating: 4.78,
      },
    };
    // convert pilots obj into PilotInterface list
    const pilots = p.pilotsFromObj(obj);

    assert.equal(pilots.length, 1, "pilotsFromObj outputs corret list length");
  });
});

// {
//     uid: string;
//     current_client_uid?: string;
//     current_latitude: number;
//     current_longitude: number;
//     current_zone: ZoneName;
//     status: PilotStatus;
//     vehicles: Array<VehicleInterface>;
//     idle_since: number;
//     rating: number;
//     score: number;
//     position: PilotPosition;
// }
