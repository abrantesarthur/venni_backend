const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;
const admin = require("firebase-admin");
let p = require("../lib/database/partners");
const { sleep } = require("../lib/utils");
const { ZoneName } = require("../lib/zones");

describe("partners", () => {
  let Partners;
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    Partners = new p.Partners();
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

  describe("countAvailablePartnersByZone", () => {
    beforeEach(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    after(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    it("returns count 0 for every ZoneName if there are no partners available at all", async () => {
      const map = await Partners.countAvailablePartnersByZone();
      for (zoneName in ZoneName) {
        if (zoneName != "is" && zoneName != "fromString") {
          assert.equal(map.get(zoneName), 0);
        }
      }
    });

    it("does not count partners whose status is not 'available'", async () => {
      // add unavailable partner to zone DB
      let unavailableInDB = {
        uid: "unavailableInDB",
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
        status: "unavailable",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin.database().ref("partners").set({
        unavailableInDB: unavailableInDB,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in DB is not counted, since he is unavailable
      assert.equal(map.get("DB"), 0);

      // now update partner in DB to be available
      await admin
        .database()
        .ref("partners")
        .child("unavailableInDB")
        .child("status")
        .set("available");

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in DB is now counted
      assert.equal(map.get("DB"), 1);
    });

    it("does not count partners whose account is not 'approved'", async () => {
      // add unapproved partner to zone DB
      let unapprovedInDC = {
        uid: "unapprovedInDC",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "pending_review",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
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
      await admin.database().ref("partners").set({
        unapprovedInDC: unapprovedInDC,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in DC is not counted, since he is unavailable
      assert.equal(map.get("DC"), 0);

      // now update partner to be available
      await admin
        .database()
        .ref("partners")
        .child("unapprovedInDC")
        .child("account_status")
        .set("approved");

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in DC is now counted
      assert.equal(map.get("DC"), 1);
    });

    it("does not count partners whose position is not set", async () => {
      // add partner without set position in GH
      let withoutPosInGH = {
        uid: "withoutPosInGH",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "",
        current_longitude: "",
        current_zone: "GH",
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
      await admin.database().ref("partners").set({
        withoutPosInGH: withoutPosInGH,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in GH is not counted, since he is unavailable
      assert.equal(map.get("GH"), 0);

      // now update partner so his position is set
      await admin.database().ref("partners").child("withoutPosInGH").update({
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
      });

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in GH is now counted
      assert.equal(map.get("GH"), 1);
    });

    it("returns number of partners available in a given zone", async () => {
      let availableOneInFC = {
        uid: "availableOneInFC",
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
        current_zone: "FC",
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
      let availableTwoInFC = {
        uid: "availableTwoInFC",
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
        current_zone: "FC",
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
      let availableThreeInFC = {
        uid: "availableThreeInFC",
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
        current_zone: "FC",
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
      let busyInFC = {
        uid: "busyInFC",
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
        current_zone: "FC",
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

      // assert there are no partners in FC
      let map = await Partners.countAvailablePartnersByZone();
      assert.equal(map.get("FC"), 0);

      // add partners to FC
      await admin.database().ref("partners").set({
        availableOneInFC: availableOneInFC,
        availableTwoInFC: availableTwoInFC,
        availableThreeInFC: availableThreeInFC,
        busyInFC: busyInFC,
      });

      // assert there are three available partners in FC
      map = await Partners.countAvailablePartnersByZone();
      assert.equal(map.get("FC"), 3);
    });
  });

  describe("countAvailablePartnersByZone", () => {
    beforeEach(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    after(async () => {
      // clear partners from database
      await admin.database().ref("partners").remove();
    });

    it("returns count 0 for every ZoneName if there are no partners available at all", async () => {
      const map = await Partners.countAvailablePartnersByZone();
      for (zoneName in ZoneName) {
        if (zoneName != "is" && zoneName != "fromString") {
          assert.equal(map.get(zoneName), 0);
        }
      }
    });

    it("does not count partners whose status is not 'available'", async () => {
      // add unavailable partner to zone DB
      let unavailableInDB = {
        uid: "unavailableInDB",
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
        status: "unavailable",
        vehicle: {
          brand: "honda",
          year: 2015,
          model: "cg-150",
          plate: "aaa-0000",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin.database().ref("partners").set({
        unavailableInDB: unavailableInDB,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in DB is not counted, since he is unavailable
      assert.equal(map.get("DB"), 0);

      // now update partner in DB to be available
      await admin
        .database()
        .ref("partners")
        .child("unavailableInDB")
        .child("status")
        .set("available");

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in DB is now counted
      assert.equal(map.get("DB"), 1);
    });

    it("does not count partners whose account is not 'approved'", async () => {
      // add unapproved partner to zone DB
      let unapprovedInDC = {
        uid: "unapprovedInDC",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "pending_review",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
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
      await admin.database().ref("partners").set({
        unapprovedInDC: unapprovedInDC,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in DC is not counted, since he is unavailable
      assert.equal(map.get("DC"), 0);

      // now update partner to be available
      await admin
        .database()
        .ref("partners")
        .child("unapprovedInDC")
        .child("account_status")
        .set("approved");

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in DC is now counted
      assert.equal(map.get("DC"), 1);
    });

    it("does not count partners whose position is not set", async () => {
      // add partner without set position in GH
      let withoutPosInGH = {
        uid: "withoutPosInGH",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        total_trips: "123",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "",
        current_longitude: "",
        current_zone: "GH",
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
      await admin.database().ref("partners").set({
        withoutPosInGH: withoutPosInGH,
      });

      // count partners
      let map = await Partners.countAvailablePartnersByZone();

      // assert partner in GH is not counted, since he is unavailable
      assert.equal(map.get("GH"), 0);

      // now update partner so his position is set
      await admin.database().ref("partners").child("withoutPosInGH").update({
        current_latitude: "-17.221879",
        current_longitude: "-46.875143",
      });

      await sleep(200);

      // count partners again
      map = await Partners.countAvailablePartnersByZone();

      // assert partner in GH is now counted
      assert.equal(map.get("GH"), 1);
    });

    it("returns number of partners available in a given zone", async () => {
      let availableOneInFC = {
        uid: "availableOneInFC",
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
        current_zone: "FC",
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
      let availableTwoInFC = {
        uid: "availableTwoInFC",
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
        current_zone: "FC",
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
      let availableThreeInFC = {
        uid: "availableThreeInFC",
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
        current_zone: "FC",
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
      let busyInFC = {
        uid: "busyInFC",
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
        current_zone: "FC",
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

      // assert there are no partners in FC
      let map = await Partners.countAvailablePartnersByZone();
      assert.equal(map.get("FC"), 0);

      // add partners to FC
      await admin.database().ref("partners").set({
        availableOneInFC: availableOneInFC,
        availableTwoInFC: availableTwoInFC,
        availableThreeInFC: availableThreeInFC,
        busyInFC: busyInFC,
      });

      // assert there are three available partners in FC
      map = await Partners.countAvailablePartnersByZone();
      assert.equal(map.get("FC"), 3);
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

      const partners = await Partners.findAllAvailable({
        origin_zone: "DC",
        origin_place_id: "ChIJGwWotolKqJQREFaef54gf3k",
        payment_method: "cash",
      });

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
      const partners = await Partners.findAllAvailable({
        origin_zone: "DC",
        origin_place_id: "ChIJGwWotolKqJQREFaef54gf3k",
        payment_method: "cash",
      });

      // because we are not trying again, returns one those in DC
      assert.equal(partners.length, 2);
      assert.equal(partners[0].uid, "availableTwoInDC");
      assert.equal(partners[1].uid, "availableThreeInDC");
    });
  });
});
