const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;
const admin = require("firebase-admin");
let p = require("../lib/database/partners");

describe("partners", () => {
  let Partners;
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    Partners = new p.Partners();
    p;
  });

  describe("fromObjs", () => {
    it("outputs empty list when obj is empty", () => {
      const partners = Partners.fromObjs({});
      assert.isEmpty(partners);
    });

    it("outputs empty list when obj doesn't conform to PartnerInterface", () => {
      const partners = Partners.fromObjs({
        invalid_partner: {
          invalid_uid: "invalid",
        },
      });
      assert.isEmpty(partners);
    });

    it("ignores irrelevant fields in obj that don't conform to PartnerInterface", () => {
      const partners = Partners.fromObjs({
        valid_partner: {
          irrelevant_field: "irrelevant",
          uid: "first_partner_uid",
          name: "Fulano",
          last_name: "de Tal",
          cpf: "00000000000",
          gender: "masculino",
          account_status: "pending_documents",
          total_trips: "123",
          member_since: Date.now().toString(),
          phone_number: "(38) 99999-9999",
          current_client_uid: "",
          current_latitude: "10.123456",
          current_longitude: "11.123456",
          current_zone: "AA",
          status: "available",
          vehicle: {
            brand: "honda",
            model: "cg-150",
            year: 2015,
            plate: "AAA-0000",
          },
          idle_since: Date.now().toString(),
          rating: "4.79",
        },
      });
      assert.equal(partners.length, 1);
      assert.equal(partners[0].irrelevant_field, undefined);
      assert.equal(partners[0].current_client_uid, "");
    });

    it("doesn't failt when obj misses optional fields", () => {
      const partners = Partners.fromObjs({
        valid_partner: {
          uid: "first_partner_uid",
          name: "Fulano",
          last_name: "de Tal",
          cpf: "00000000000",
          gender: "masculino",
          account_status: "pending_documents",
          total_trips: "123",
          member_since: Date.now().toString(),
          phone_number: "(38) 99999-9999",
          current_latitude: "10.123456",
          current_longitude: "11.123456",
          current_zone: "AA",
          status: "available",
          vehicle: {
            brand: "honda",
            model: "cg-150",
            year: 2015,
            plate: "AAA-0000",
          },
          idle_since: Date.now().toString(),
          rating: "4.79",
        },
      });
      assert.equal(partners.length, 1);
      assert.equal(partners[0].current_client_uid, undefined);
      assert.equal(partners[0].score, undefined);
      assert.equal(partners[0].position, undefined);
    });

    it("outputs PartnerInterface list when parameters are valid", () => {
      let idleSince = Date.now().toString();
      let rating = "4.79";
      const obj = {
        first_partner_uid: {
          uid: "first_partner_uid",
          name: "Fulano",
          last_name: "de Tal",
          cpf: "00000000000",
          gender: "masculino",
          account_status: "pending_documents",
          total_trips: "123",
          member_since: Date.now().toString(),
          phone_number: "(38) 99999-9999",
          current_client_uid: "",
          current_latitude: "10.123456",
          current_longitude: "11.123456",
          current_zone: "AA",
          status: "available",
          vehicle: {
            brand: "honda",
            model: "cg-150",
            year: 2015,
            plate: "AAA-0000",
          },
          idle_since: idleSince,
          rating: rating,
        },
      };

      // convert partners obj into PartnerInterface list
      const partners = Partners.fromObjs(obj);

      assert.equal(partners.length, 1);
      assert.equal(partners[0].uid, "first_partner_uid");
      assert.equal(partners[0].current_client_uid, "");
      assert.equal(partners[0].current_latitude, "10.123456");
      assert.equal(partners[0].current_longitude, "11.123456");
      assert.equal(partners[0].current_zone, "AA");
      assert.equal(partners[0].status, "available");
      assert.equal(partners[0].idle_since, idleSince);
      assert.equal(partners[0].rating, rating);
      assert.equal(partners[0].vehicle.brand, "honda");
      assert.equal(partners[0].vehicle.model, "cg-150");
      assert.equal(partners[0].vehicle.year, 2015);
      assert.equal(partners[0].vehicle.plate, "AAA-0000");
      assert.equal(partners[0].score, undefined);
      assert.equal(partners[0].position, undefined);
    });
  });

  const asyncExpectThrows = async (method, errorCode, errorMessage) => {
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

  describe("assignPartnersDistanceToClient", () => {
    let defaultOriginPlaceID;
    let defaultPartners;

    before(() => {
      defaultOriginPlaceID = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
      defaultPartners = [
        {
          uid: "uid",
          name: "Fulano",
          last_name: "de Tal",
          phone_number: "(38) 99999-9999",
          current_latitude: "-17.217587",
          current_longitude: "-46.881064",
          current_zone: "AA",
          status: "available",
          vehicle: {},
          idle_since: Date.now().toString(),
          rating: "5.0",
        },
      ];
    });

    it("works", async () => {
      assert.isTrue(defaultPartners[0].distance_to_client == undefined);

      const partnersWithDistances = await Partners.assignDistances(
        defaultOriginPlaceID,
        defaultPartners,
        process.env.GOOGLE_MAPS_API_KEY
      );

      assert.isTrue(partnersWithDistances[0].distance_to_client != undefined);
      assert.equal(
        partnersWithDistances[0].distance_to_client.distance_text,
        "0,9 km"
      );
      assert.equal(
        partnersWithDistances[0].distance_to_client.distance_value,
        "927"
      );
    });

    it("throws error on wrong api key", async () => {
      await asyncExpectThrows(
        () =>
          Partners.assignDistances(
            defaultOriginPlaceID,
            defaultPartners,
            "WRONGAPIKEY"
          ),
        "internal",
        "failed to communicate with Google Distance Matrix API."
      );
    });
  });

  describe("distanceScore", () => {
    it("yields 0 points for distances greater than 1999 meters", () => {
      assert.isBelow(Partners.distanceScore(1999), 1);
      assert.equal(Partners.distanceScore(2000), 0);
      assert.equal(Partners.distanceScore(10000), 0);
    });

    it("yields 50 points for distances smaller than 100 meters", () => {
      assert.equal(Partners.distanceScore(100), 50);
      assert.equal(Partners.distanceScore(0), 50);
    });

    it("yields between 0 and 50 points for distances between 100 and 2000 meters", () => {
      for (var i = 150; i < 2000; i = i + 50) {
        assert.isAbove(Partners.distanceScore(i), 0);
        assert.isBelow(Partners.distanceScore(i), 50);
      }
    });
  });

  describe("ratingScore", () => {
    it("yields 0 points for ratings smaller than 3", () => {
      assert.equal(Partners.ratingScore(3), 0);
      assert.equal(Partners.ratingScore(0), 0);
    });

    it("yields 10 points for ratings greater or equal to 5", () => {
      assert.equal(Partners.ratingScore(5), 10);
      assert.equal(Partners.ratingScore(7), 10);
    });

    it("yields between 0 and 10 points for ratings between 3 and 5 meters", () => {
      for (var i = 3.1; i < 5; i = i + 0.1) {
        assert.isAbove(Partners.ratingScore(i), 0);
        assert.isBelow(Partners.ratingScore(i), 10);
      }
    });
  });

  describe("idleTimeScore", () => {
    it("yields 0 points for idleness equal to 0 seconds", () => {
      assert.equal(Partners.idleTimeScore(0), 0);
    });

    it("yields 40 points for idleness equal to 15 minutes", () => {
      assert.equal(Partners.idleTimeScore(900), 40);
    });

    it("yields between 0 and 40 points for idleness between 0 and 15 minutes", () => {
      for (var i = 10; i < 900; i = i + 10) {
        assert.isAbove(Partners.idleTimeScore(i), 0);
        assert.isBelow(Partners.idleTimeScore(i), 40);
      }
    });

    it("yields more than 40 points for idleness longer than 15 minutes", () => {
      for (var i = 910; i < 3000; i = i + 10) {
        assert.isAbove(Partners.idleTimeScore(i), 40);
      }
    });
  });

  describe("rank", () => {
    let defaultPartner1;
    let defaultPartner2;
    let now;
    before(() => {
      now = Date.now();
      // just finished a trip, is right next to client, and has maximum rating
      defaultPartner1 = {
        uid: "partner1",
        name: "Fulano",
        last_name: "de Tal",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "status",
        vehicle: {},
        idle_since: now.toString(),
        rating: "5.0",
        position: {
          distance_value: 0,
        },
      };
      // just finished a trip, is right next to client, and has maximum rating
      defaultPartner2 = {
        uid: "partner2",
        name: "Beltrano",
        last_name: "de Tal",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 88888-8888",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "status",
        vehicle: {},
        idle_since: now.toString(),
        rating: "5.0",
        position: {
          distance_value: 0,
        },
      };
    });

    it("partner with more idle time is ranked higher", () => {
      // partner 1 has more idle time
      defaultPartner1.idle_since = (now - 300).toString();

      // partner 2 comes first initially
      let partners = [defaultPartner2, defaultPartner1];

      const rankedPartners = Partners.rank(partners);

      // now, partner 1 comes first
      assert.equal(rankedPartners[0].uid, "partner1");
    });

    it("partner with more higher rating is ranked higher", () => {
      // partner 2 has lower rating
      defaultPartner2.rating = "4";

      // partner 2 comes first initially
      let partners = [defaultPartner2, defaultPartner1];

      const rankedPartners = Partners.rank(partners);

      // now, partner 1 comes first
      assert.equal(rankedPartners[0].uid, "partner1");
    });

    it("partner closer to the client is ranked higher", () => {
      // partner 2 is farther away from client
      defaultPartner2.position.distance_value = 1000;

      // partner 2 comes first initially
      let partners = [defaultPartner2, defaultPartner1];

      const rankedPartners = Partners.rank(partners);

      // now, partner 1 comes first
      assert.equal(rankedPartners[0].uid, "partner1");
    });
  });

  describe("filterByZone", () => {
    let partnerBB;
    let partnerCC;
    let partnerHD;
    before(() => {
      partnerBB = {
        uid: "partnerBB",
        current_zone: "BB",
      };
      partnerCC = {
        uid: "partnerCC",
        current_zone: "CC",
      };
      partnerHD = {
        uid: "partnerHD",
        current_zone: "HD",
      };
    });

    it("returns only partners in current zone if not trying again", () => {
      // there are two partners in BB and we are not trying again
      let twoPartnersInBB = [partnerBB, partnerBB, partnerCC];
      let filteredPartners = Partners.filterByZone(
        "BB",
        twoPartnersInBB,
        false
      );

      // function doesn't returns partner in zone CC
      assert.equal(filteredPartners.length, 2);
      assert.equal(filteredPartners[0].uid, "partnerBB");
      assert.equal(filteredPartners[1].uid, "partnerBB");

      // however, if tryingAgain argument is true
      filteredPartners = Partners.filterByZone("BB", twoPartnersInBB, true);

      // function also returns partner in zone CC
      assert.equal(filteredPartners.length, 3);
      assert.equal(filteredPartners[0].uid, "partnerBB");
      assert.equal(filteredPartners[1].uid, "partnerBB");
      assert.equal(filteredPartners[2].uid, "partnerCC");

      // if there is one partner in BB and not trying again
      let onePartnerInBB = [partnerBB, partnerCC, partnerCC, partnerCC];
      filteredPartners = Partners.filterByZone("BB", onePartnerInBB, false);

      // returns only the partner in zone BB
      assert.equal(filteredPartners.length, 1);
      assert.equal(filteredPartners[0].uid, "partnerBB");

      // but if tryingAgain
      filteredPartners = Partners.filterByZone("BB", onePartnerInBB, true);

      // even though there is one partner in BB, we also return those in CC since we're trying again
      assert.equal(filteredPartners.length, 4);
      assert.equal(filteredPartners[0].uid, "partnerBB");
      assert.equal(filteredPartners[1].uid, "partnerCC");
      assert.equal(filteredPartners[2].uid, "partnerCC");
      assert.equal(filteredPartners[3].uid, "partnerCC");

      // if there are no partners in BB, we return those in CC regardless of
      // whether trying again or not
      let noPartnersInBB = [partnerCC, partnerCC, partnerCC, partnerCC];
      filteredPartners = Partners.filterByZone("BB", noPartnersInBB, false);

      // since there is no partners in BB, function returns partners in zone CC
      assert.equal(filteredPartners.length, 4);
      assert.equal(filteredPartners[0].uid, "partnerCC");
      assert.equal(filteredPartners[1].uid, "partnerCC");
      assert.equal(filteredPartners[2].uid, "partnerCC");
      assert.equal(filteredPartners[3].uid, "partnerCC");

      filteredPartners = Partners.filterByZone("BB", noPartnersInBB, true);
      assert.equal(filteredPartners.length, 4);
      assert.equal(filteredPartners[0].uid, "partnerCC");
      assert.equal(filteredPartners[1].uid, "partnerCC");
      assert.equal(filteredPartners[2].uid, "partnerCC");
      assert.equal(filteredPartners[3].uid, "partnerCC");
    });
  });

  describe("findAllAvailable", () => {
    beforeEach(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    after(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    it("filters out partner's with account_status different from 'approved'", async () => {
      let approvedPartner = {
        uid: "approvedPartner",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
        current_zone: "DB",
        status: "available",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      let blockedPartner = {
        uid: "blockedPartner",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "blocked",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
        current_zone: "DB",
        status: "available",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };

      // add partners to database
      await admin.database().ref("partners").set({
        blockedPartner: blockedPartner,
        approvedPartner: approvedPartner,
      });

      // find available partners near zone DC
      const partners = await Partners.findAllAvailable(
        {
          origin_zone: "DC",
          origin_place_id: "ChIJGwWotolKqJQREFaef54gf3k",
          payment_method: "cash",
        },
        false
      );

      assert.equal(partners.length, 1);
      assert.equal(partners[0].uid, "approvedPartner");
    });

    it("works", async () => {
      let availableOneInDB = {
        uid: "availableOneInDB",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
        current_zone: "DB",
        status: "available",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      let availableTwoInDC = {
        uid: "availableTwoInDC",
        name: "Ciclano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 77777-8888",
        current_latitude: "-17.221035",
        current_longitude: "-46.863207",
        current_zone: "DC",
        status: "available",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      let availableThreeInDC = {
        uid: "availableThreeInDC",
        name: "Ciclano",
        last_name: "de Fulano",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 77777-8888",
        current_latitude: "-17.221471",
        current_longitude: "-46.86266",
        current_zone: "DC",
        status: "available",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      let busyInDC = {
        uid: "busyInDC",
        name: "Betrano",
        last_name: "de Ciclano",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 77777-8888",
        current_latitude: "-17.222722",
        current_longitude: "-46.861959",
        current_zone: "DC",
        status: "busy",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };

      // add partners to database
      await admin.database().ref("partners").set({
        availableOneInDB: availableOneInDB,
        availableTwoInDC: availableTwoInDC,
        availableThreeInDC: availableThreeInDC,
        busyInDC: busyInDC,
      });

      // find available partners near zone DC
      const partners = await Partners.findAllAvailable(
        {
          origin_zone: "DC",
          origin_place_id: "ChIJGwWotolKqJQREFaef54gf3k",
          payment_method: "cash",
        },
        false
      );

      // because we are not trying again, returns one those in DC
      assert.equal(partners.length, 2);
      assert.equal(partners[0].uid, "availableTwoInDC");
      assert.equal(partners[1].uid, "availableThreeInDC");
    });
  });
});
