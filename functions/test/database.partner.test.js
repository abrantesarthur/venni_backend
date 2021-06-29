const p = require("../lib/database/Partner");
const chai = require("chai");
const admin = require("firebase-admin");
const { PartnerPastTrips } = require("../lib/database/pastTrips");

const assert = chai.assert;

describe("Partner", () => {
  let Partner;
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
  });

  describe("Class", () => {
    let clientID;
    let partnerID;
    let defaultPartner;
    let defaultTrip;
    before(async () => {
      clientID = "clientID";
      partnerID = "partnerID";
      defaultPartner = {
        uid: partnerID,
        name: "name",
        last_name: "last_name",
        cpf: "00000000000",
        gender: "masculino",
        member_since: (Date.now() - 100000000).toString(),
        phone_number: "phone_number",
        current_latitude: "-16",
        current_longitude: "42",
        current_zone: "AA",
        status: "busy",
        account_status: "pending_documents",
        current_client_uid: clientID,
        vehicle: {
          brand: "brand",
          model: "model",
          year: 1999,
          plate: "plate",
        },
        idle_since: (Date.now() - 100000).toString(),
        rating: "rating",
        pagarme_recipient_id: "pagarme_received_id",
        amount_owed: 2,
      };
      defaultClient = {
        uid: clientID,
        rating: "5",
      };
      defaultTrip = {
        uid: clientID,
        trip_status: "completed",
        origin_place_id: "origin_place_id",
        destination_place_id: "destination_place_id",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: 100,
        distance_text: "100 metes",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
      };
      Partner = new p.Partner(partnerID);

      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("partners").remove();
      await admin.database().ref("past-trips").remove();
    });

    after(async () => {
      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("partners").remove();
      await admin.database().ref("past-trips").remove();
    });

    describe("getPartner", () => {
      it("returns undefined if partner does not exist", async () => {
        let result = await Partner.getPartner();
        assert.isUndefined(result);
      });

      it("returns Partner.Interface if partner exists", async () => {
        // add partner to database
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        let result = await Partner.getPartner();
        assert.isDefined(result);

        // clear database
        await admin.database().ref("partners").remove();
      });
    });

    describe("free", () => {
      it("sets the partner's status to available, empties its current_client_uid, and resets its idle_time to now", async () => {
        // add partner to the database
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // assert partner hasn't been freed
        let result = await Partner.getPartner();
        assert.equal(result.uid, partnerID);
        assert.equal(result.status, "busy");
        assert.equal(result.current_client_uid, clientID);
        assert.isBelow(Number(result.idle_since), Date.now() - 1000);

        // call free
        await Partner.free();

        // assert partner has been freed
        result = await Partner.getPartner();
        assert.equal(result.uid, partnerID);
        assert.equal(result.status, "available");
        assert.equal(result.current_client_uid, "");
        assert.isAbove(Number(result.idle_since), Date.now() - 1000);

        // clear database
        await admin.database().ref("partners").remove();
      });
    });

    describe("pushPastTrip", () => {
      it("pushes trip to partner's list of past trips", async () => {
        // assert partner has no past trips
        let ppt = new PartnerPastTrips(partnerID);
        let pastTripsCount = await ppt.getPastTripsCount();
        assert.equal(pastTripsCount, 0);

        // call pushPastTrip
        await Partner.pushPastTrip(defaultTrip);

        // assert partner has past trips
        pastTripsCount = await ppt.getPastTripsCount();
        assert.equal(pastTripsCount, 1);

        // clear database
        await admin.database().ref("past-trips").remove();
      });

      it("increments partner's total_trips", async () => {
        // add partner to database
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // assert partner has no total_trips
        let result = await Partner.getPartner();
        assert.isUndefined(result.total_trips);

        // call pushPastTrip
        await Partner.pushPastTrip(defaultTrip);

        // assert partner has total_trips
        result = await Partner.getPartner();
        assert.equal(result.total_trips, "1");

        // clear database
        await admin.database().ref("partners").remove();
        await admin.database().ref("past-trips").remove();
      });
    });

    describe("getAmountOwed", () => {
      before(async () => {
        // clear database
        await admin.database().ref("partners").remove();
      });

      it("returns a number if partner has amount_owed", async () => {
        // add partner to database with amount_owed defined
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount equals 2
        assert.equal(amountOwed, 2);
      });

      it("returns null if partner has no amount_owed", async () => {
        // add partner to database without amount_owed
        delete defaultPartner["amount_owed"];
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount owed is null
        assert.isNull(amountOwed);

        // rever defaultPartner
        defaultPartner["amount_owed"] = 2;
      });
    });

    describe("increaseAmountOwedBy", () => {
      it("increments amount owed by 'amount'", async () => {
        // add partner to database with amount_owed equal 2
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount equals 2
        assert.equal(amountOwed, 2);

        // increment amount owed by 3
        await Partner.increaseAmountOwedBy(3);

        // get amount owed anad assert it's 5
        amountOwed = await Partner.getAmountOwed();
        assert.equal(amountOwed, 5);
      });

      it("sets amount_owed if it is undefined", async () => {
        // add partner to database with undefined amount_owed
        delete defaultPartner["amount_owed"];
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount is null
        assert.isNull(amountOwed);

        // increase amount owed by 2
        await Partner.increaseAmountOwedBy(2);

        // get amount owed and assert it's 2
        amountOwed = await Partner.getAmountOwed();
        assert.equal(amountOwed, 2);

        // reset amount_owed
        defaultPartner["amount_owed"] = 2;
      });
    });

    describe("decreaseAmountOwedBy", () => {
      it("increments amount owed by 'amount'", async () => {
        // add partner to database with amount_owed equal 2
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount equals 2
        assert.equal(amountOwed, 2);

        // decreasee amount owed by 1
        await Partner.decreaseAmountOwedBy(1);

        // get amount owed anad assert it's 1
        amountOwed = await Partner.getAmountOwed();
        assert.equal(amountOwed, 1);
      });

      it("sets amount_owed if it is undefined", async () => {
        // add partner to database with undefined amount_owed
        delete defaultPartner["amount_owed"];
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // get amount owed
        let amountOwed = await Partner.getAmountOwed();

        // assert amount is null
        assert.isNull(amountOwed);

        // decrease amount owed by 1
        await Partner.decreaseAmountOwedBy(1);

        // get amount owed and assert it's -1
        amountOwed = await Partner.getAmountOwed();
        assert.equal(amountOwed, -1);

        // reset amount_owed
        defaultPartner["amount_owed"] = 2;
      });
    });

    describe("connect", () => {
      it("sets partner as 'available' and sets latitude and longitude", async () => {
        // add 'unavailable' partner to the databse without latitude or longitude
        defaultPartner["status"] = "unavailable";
        delete defaultPartner["current_latitude"];
        delete defaultPartner["current_longitude"];
        delete defaultPartner["idle_since"];
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // assert it worked
        let partner = await Partner.getPartner();

        assert.isDefined(partner);
        assert.equal(partner.status, "unavailable");
        assert.isUndefined(partner.current_latitude);
        assert.isUndefined(partner.current_longitude);
        assert.isUndefined(partner.idle_since);

        // request to connect partner
        await Partner.connect(50.555555, 10.111111);

        // assert hat partner was sucessfully connected
        partner = await Partner.getPartner();

        assert.isDefined(partner);
        assert.equal(partner.status, "available");
        assert.equal(partner.current_latitude, "50.555555");
        assert.equal(partner.current_longitude, "10.111111");
        assert.isDefined(partner.idle_since);
      });
    });

    describe("disconnect", () => {
      it("sets partner as 'unavailable'", async () => {
        // add 'available' partner to the databse
        defaultPartner["status"] = "available";
        await admin
          .database()
          .ref("partners")
          .child(partnerID)
          .set(defaultPartner);

        // assert it worked
        let partner = await Partner.getPartner();

        assert.isDefined(partner);
        assert.equal(partner.status, "available");
        // request to disconnect partner
        await Partner.disconnect();

        // assert that partner was sucessfully disconnected
        partner = await Partner.getPartner();
        assert.isDefined(partner);
        assert.equal(partner.status, "unavailable");
      });
    });
  });

  describe("Interface", () => {
    let validArg;

    before(() => {
      Partner = p.Partner;
    });

    beforeEach(() => {
      validArg = {
        uid: "uid",
        name: "name",
        last_name: "last_name",
        cpf: "00000000000",
        gender: "masculino",
        member_since: "member_since",
        phone_number: "phone_number",
        current_latitude: "current_latitude",
        current_longitude: "current_longitude",
        current_zone: "current_zone",
        status: "status",
        account_status: "pending_documents",
        vehicle: {
          brand: "brand",
          model: "model",
          year: "year",
          plate: "plate",
        },
        idle_since: "idle_since",
        rating: "rating",
        total_trips: "102",
        score: 78,
        pagarme_recipient_id: "pagarme_received_id",
        amount_owed: 23,
      };
    });

    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Partner.Interface.is(undefined), false);
      });
      it("returns false when object is null", () => {
        assert.equal(Partner.Interface.is(null), false);
      });
      it("returns false when object is empty", () => {
        assert.equal(Partner.Interface.is({}), false);
      });

      it("returns false if obj contains vehicle that is not a Vehicle.Interface", () => {
        let invalidArg = validArg;
        (invalidArg["vehicle"] = {
          brand: "brand",
        }),
          assert.equal(Partner.Interface.is(invalidArg), false);
      });

      // test optional fields types
      const falseIfOptionalWronglyTyped = (field, wrongValue) => {
        it(
          "returns false if, '" + field + "', is present and has wrong type",
          () => {
            let invalidArg = validArg;
            invalidArg[field] = wrongValue;
            assert.equal(Partner.Interface.is(invalidArg), false);
            delete invalidArg[field];
            assert.equal(Partner.Interface.is(invalidArg), true);
          }
        );
      };
      falseIfOptionalWronglyTyped("total_trips", 123);
      falseIfOptionalWronglyTyped("member_since", 123);
      falseIfOptionalWronglyTyped("score", "not a number");
      falseIfOptionalWronglyTyped("pagarme_recipient_id", 123);
      falseIfOptionalWronglyTyped("amount_owed", "not a number");
      falseIfOptionalWronglyTyped("lock_reason", 123);
      falseIfOptionalWronglyTyped("vehicle", { invalid_field: "invalid" });
      falseIfOptionalWronglyTyped("submitted_documents", {
        invalid_field: "invalid",
      });
      falseIfOptionalWronglyTyped("bank_account", { invalid_field: "invalid" });

      it("returns true if obj is Partner.Interface", () => {
        assert.equal(Partner.Interface.is(validArg), true);
      });
    });

    describe("fromObj", () => {
      let validArg;
      beforeEach(() => {
        validArg = {
          uid: "uid",
          name: "name",
          last_name: "last_name",
          cpf: "00000000000",
          gender: "masculino",
          member_since: "member_since",
          phone_number: "phone_number",
          current_latitude: "current_latitude",
          current_longitude: "current_longitude",
          current_zone: "current_zone",
          status: "status",
          account_status: "pending_documents",
          vehicle: {
            brand: "brand",
            model: "model",
            year: "year",
            plate: "plate",
          },
          submitted_documents: {
            cnh: true,
            photo_with_cnh: false,
          },
          idle_since: "idle_since",
          rating: "rating",
          total_trips: "102",
          score: 78,
          pagarme_recipient_id: "pagarme_received_id",
          amount_owed: 23,
        };
      });
      it("returns undefined if obj is null", () => {
        assert.isUndefined(Partner.Interface.fromObj(null));
      });
      it("returns undefined if obj is undefined", () => {
        assert.isUndefined(Partner.Interface.fromObj(undefined));
      });
      it("returns undefined if obj is empty", () => {
        assert.isUndefined(Partner.Interface.fromObj({}));
      });

      it("returns Partner.Interface even if obj is missing optional fields", () => {
        delete validArg["total_trips"];
        delete validArg["score"];
        delete validArg["pagarme_recipient_id"];
        delete validArg["amount_owed"];
        const response = Partner.Interface.fromObj(validArg);
        assert.isDefined(response);
        assert.equal(response.uid, "uid");
        assert.equal(response.gender, "masculino");
        assert.isUndefined(response.total_trips);
        assert.isUndefined(response.score);
        assert.isUndefined(response.pagarme_recipient_id);
        assert.isUndefined(response.amount_owed);
      });

      it("returns Partner.Interface if obj is Partner.Interface", () => {
        const response = Partner.Interface.fromObj(validArg);
        assert.isDefined(response);
        assert.equal(response.uid, "uid");
      });
    });
  });

  describe("AppBankAccount", () => {
    let validBankAccount;
    before(() => {
      Partner = p.Partner;
    });

    beforeEach(() => {
      validBankAccount = {
        id: 1,
        bank_code: "000",
        agency: "0000",
        agency_dv: "0",
        account: "00000",
        account_dv: "0",
        type: "conta_corrente",
        document_type: "cpf",
        document_number: "00000000000",
        charge_transfer_fees: true,
        legal_name: "Fulano de Tal",
      };
    });

    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Partner.AppBankAccount.is(undefined), false);
      });

      it("returns false when object is null", () => {
        assert.equal(Partner.AppBankAccount.is(null), false);
      });

      it("returns false when object is empty", () => {
        assert.equal(Partner.AppBankAccount.is({}), false);
      });

      it("returns false when object has invalid key", () => {
        assert.equal(Partner.AppBankAccount.is({ invalid: "invalid" }), false);
      });

      const falseIfOptionalWronglyTyped = (field, wrongValue) => {
        it(
          "returns false if '" + field + "' is present and has wrong type",
          () => {
            let bankAccount = validBankAccount;
            bankAccount[field] = wrongValue;
            assert.equal(Partner.AppBankAccount.is(bankAccount), false);
            delete bankAccount[field];
            assert.equal(Partner.AppBankAccount.is(bankAccount), true);
          }
        );
      };

      falseIfOptionalWronglyTyped("id", "not a number");
      falseIfOptionalWronglyTyped("agency_dv", 1);
      falseIfOptionalWronglyTyped("document_type", 1);
      falseIfOptionalWronglyTyped("charge_transfer_fees", "true");

      it("returns true when obj is valid", () => {
        assert.equal(Partner.AppBankAccount.is(validBankAccount), true);
      });
    });
  });

  describe("SubmittedDocuments", () => {
    let validSubmittedDocuments;
    before(() => {
      Partner = p.Partner;
    });

    beforeEach(() => {
      validSubmittedDocuments = {
        cnh: true,
        crlv: true,
        photo_with_cnh: true,
        profile_photo: true,
        bank_account: true,
      };
    });

    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Partner.SubmittedDocuments.is(undefined), false);
      });

      it("returns false when object is null", () => {
        assert.equal(Partner.SubmittedDocuments.is(null), false);
      });

      it("returns false when object has invalid key", () => {
        assert.equal(
          Partner.SubmittedDocuments.is({ invalid: "invalid" }),
          false
        );
      });

      const falseIfOptionalWronglyTyped = (field, wrongValue) => {
        it(
          "returns false if '" + field + "' is present and has wrong type",
          () => {
            let submittedDocuments = validSubmittedDocuments;
            submittedDocuments[field] = wrongValue;
            assert.equal(
              Partner.SubmittedDocuments.is(submittedDocuments),
              false
            );
            delete submittedDocuments[field];
            assert.equal(
              Partner.SubmittedDocuments.is(submittedDocuments),
              true
            );
          }
        );
      };

      falseIfOptionalWronglyTyped("cnh", "true");
      falseIfOptionalWronglyTyped("crlv", "true");
      falseIfOptionalWronglyTyped("photo_with_cnh", "true");
      falseIfOptionalWronglyTyped("profile_photo", "true");
      falseIfOptionalWronglyTyped("bank_account", "true");

      it("returns true when obj is valid", () => {
        assert.equal(
          Partner.SubmittedDocuments.is(validSubmittedDocuments),
          true
        );
      });
    });
  });

  describe("Vehicle", () => {
    let validVehicle;
    before(() => {
      Partner = p.Partner;
    });

    beforeEach(() => {
      validVehicle = {
        brand: "brand",
        year: 2020,
        model: "model",
        plate: "plate",
      };
    });

    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Partner.Vehicle.is(undefined), false);
      });

      it("returns false when object is null", () => {
        assert.equal(Partner.Vehicle.is(null), false);
      });

      it("returns false when object has invalid key", () => {
        assert.equal(Partner.Vehicle.is({ invalid: "invalid" }), false);
      });

      it("returns true when obj is valid", () => {
        assert.equal(Partner.Vehicle.is(validVehicle), true);
      });
    });
  });
});
