const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;

describe("pilosFromObj", () => {
  let p;
  before(() => {
    p = require("../lib/pilots");
  });

  it("outputs empty list when obj is empty", () => {
    const pilots = p.pilotsFromObj({});
    assert.equal(pilots.length, 0);
  });

  it("outputs empty list when obj doesn't conform to PilotInterface", () => {
    const pilots = p.pilotsFromObj({
      invalid_pilot: {
        invalid_uid: "invalid",
      },
    });
    assert.equal(pilots.length, 0);
  });

  it("ignores irrelevant fields in obj that don't conform to PilotInterface", () => {
    const pilots = p.pilotsFromObj({
      valid_pilot: {
        irrelevant_field: "irrelevant",
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
        rating: 4.79,
      },
    });
    assert.equal(pilots.length, 1);
    assert.equal(pilots[0].irrelevant_field, undefined);
    assert.equal(pilots[0].current_client_uid, "");
  });

  it("doesn't failt when obj misses optional fields", () => {
    const pilots = p.pilotsFromObj({
      valid_pilot: {
        uid: "first_pilot_uid",
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
        rating: 4.79,
      },
    });
    assert.equal(pilots.length, 1);
    assert.equal(pilots[0].current_client_uid, undefined);
    assert.equal(pilots[0].score, undefined);
    assert.equal(pilots[0].position, undefined);
  });

  it("outputs PilotInterface list when parameters are valid", () => {
    let idleSince = Date.now();
    let rating = 4.79;
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
        idle_since: idleSince,
        rating: rating,
      },
    };

    // convert pilots obj into PilotInterface list
    const pilots = p.pilotsFromObj(obj);

    assert.equal(pilots.length, 1);
    assert.equal(pilots[0].uid, "first_pilot_uid");
    assert.equal(pilots[0].current_client_uid, "");
    assert.equal(pilots[0].current_latitude, 10.123456);
    assert.equal(pilots[0].current_longitude, 11.123456);
    assert.equal(pilots[0].current_zone, "AA");
    assert.equal(pilots[0].status, "available");
    assert.equal(pilots[0].idle_since, idleSince);
    assert.equal(pilots[0].rating, rating);
    assert.equal(pilots[0].vehicles.length, 1);
    assert.equal(pilots[0].vehicles[0].brand, "honda");
    assert.equal(pilots[0].vehicles[0].model, "cg-150");
    assert.equal(pilots[0].vehicles[0].year, 2015);
    assert.equal(pilots[0].vehicles[0].plate, "AAA-0000");
    assert.equal(pilots[0].score, undefined);
    assert.equal(pilots[0].position, undefined);
  });
});

const expectThrowsAsync = async (method, errorCode, errorMessage) => {
  let error = null;
  try {
    await method();
  } catch (err) {
    error = err;
  }
  expect(error).to.be.an("Error");
  expect(error.message).to.equal(errorMessage);
  expect(error.code).to.equal(errorCode);
};

describe("assignPilotDistances", () => {
  let defaultOriginPlaceID;
  let defaultPilots;
  let p;

  before(() => {
    p = require("../lib/pilots");
    defaultOriginPlaceID = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
    defaultPilots = [
      {
        uid: "uid",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "status",
        vehicles: [],
        idle_since: "idle_since",
        rating: "rating",
      },
    ];
  });

  it("works", async () => {
    assert.isTrue(defaultPilots[0].position == undefined);

    const pilotsWithDistances = await p.assignPilotDistances(
      defaultOriginPlaceID,
      defaultPilots,
      process.env.GOOGLE_MAPS_API_KEY
    );

    assert.isTrue(pilotsWithDistances[0].position != undefined);
    assert.equal(pilotsWithDistances[0].position.distance_text, "0,9 km");
    assert.equal(pilotsWithDistances[0].position.distance_value, "927");
  });

  it("throws error on wrong api key", async () => {
    await expectThrowsAsync(
      () =>
        p.assignPilotDistances(
          defaultOriginPlaceID,
          defaultPilots,
          "WRONGAPIKEY"
        ),
      "internal",
      "failed to communicate with Google Distance Matrix API."
    );
  });
});
