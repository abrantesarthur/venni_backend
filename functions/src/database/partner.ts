import { Database, transaction } from ".";
import { ZoneName } from "../zones";
import { PartnerPastTrips } from "./pastTrips";
import { TripRequest } from "./tripRequest";

export class Partner extends Database {
  readonly ref: Database.Reference;
  readonly id: string;

  constructor(partnerID: string) {
    super();
    this.id = partnerID;
    this.ref = this.DB.ref("partners").child(partnerID);
  }

  getPartner = async (): Promise<Partner.Interface | undefined> => {
    const snapshot = await this.ref.once("value");
    return Partner.Interface.fromObj(snapshot.val());
  };

  remove = async (): Promise<any> => {
    return await this.ref.remove();
  };

  update = async (values: Object) => {
    return await this.ref.update(values);
  };

  lockAccount = async (lockReason: string) => {
    return await this.ref.update({
      account_status: "locked",
      lock_reason: lockReason,
    });
  };

  // freePartner sets the partner's status to available, empties its current_client_uid,
  // and resets its idle_time to now.
  free = async (resetIdleSince = true) => {
    await transaction(this.ref, (partner: Partner.Interface) => {
      if (partner == null) {
        return {};
      }
      partner.status = Partner.Status.available;
      partner.current_client_uid = "";
      if(resetIdleSince) {
        partner.idle_since = Date.now().toString();
      }
      return partner;
    });
  };

  private incrementTotalTrips = async () => {
    await transaction(this.ref, (partner: Partner.Interface) => {
      if (partner == null) {
        return {};
      }
      let totalTrips = 1;
      if (partner.total_trips != undefined) {
        totalTrips += Number(partner.total_trips);
      }
      partner.total_trips = totalTrips.toString();
      return partner;
    });
  };

  pushPastTrip = async (
    trip: TripRequest.Interface
  ): Promise<string | null> => {
    if (trip == undefined) {
      return null;
    }
    // push trip to past_trips
    let ppt = new PartnerPastTrips(this.id);
    let refKey = await ppt.pushPastTrip(trip);

    // increase partner's total_trips count
    await this.incrementTotalTrips();

    return refKey;
  };

  // rateObj has the following interface:
  // partner_rating: {
  //   score: number;
  //   cleanliness_went_well?: bool;
  //   safety_went_well?: bool;
  //   waiting_time_went_well?: bool;
  //   feedback: string;
  // }
  rate = async (pastTripRefKey: string, rateObj: any) => {
    // update partner's past trip
    const ppt = new PartnerPastTrips(this.id);
    await ppt.updatePastTrip(pastTripRefKey, rateObj);

    // get partner
    let partner = await this.getPartner();
    if (partner == undefined) {
      return;
    }

    // get partner's past 200 trips
    let last200Trips = await ppt.getPastTrips(200);

    // calculate rating
    if (last200Trips != undefined) {
      let last200TotalRating = 0;
      let last200NumberOfRatings = 0;
      last200Trips.forEach((trip) => {
        if (
          trip.partner_rating != undefined &&
          trip.partner_rating.score != undefined
        ) {
          last200TotalRating += Number(trip.partner_rating.score);
          last200NumberOfRatings += 1;
        }
      });

      // rating is 5 until partner has done at least 5 trips. Then it's an average of
      // the ratings of the last 200 trips.
      let rating =
        last200Trips.length < 5
          ? 5
          : last200TotalRating / last200NumberOfRatings;
      await this.ref
        .child("rating")
        .set(((rating * 100) / 100).toFixed(2).toString());
    }
  };

  getAmountOwed = async (): Promise<number | null> => {
    return (await this.ref.child("amount_owed").once("value")).val();
  };

  // increaseAmountOwedBy uses transaction to increase amount owed by partner by 'amount'
  increaseAmountOwedBy = async (amount: number) => {
    await transaction(this.ref, (partner: Partner.Interface) => {
      if (partner == null) {
        return {};
      }
      let amountOwed = amount;
      if (partner.amount_owed != undefined) {
        amountOwed += partner.amount_owed;
      }
      partner.amount_owed = Math.ceil(amountOwed);
      return partner;
    });
  };

  // decreaseAmountOwedBy uses transaction to decrease amount owed by partner by 'amount'
  decreaseAmountOwedBy = async (amount: number) => {
    await this.increaseAmountOwedBy(-amount);
  };

  createBankAccount = async (bankAccount: Partner.AppBankAccount) => {
    await this.ref.child("bank_account").set(bankAccount);
  };

  connect = async (lat: number, lng: number) => {
    await transaction(this.ref, (partner: Partner.Interface) => {
      if (partner == null) {
        return {};
      }
      partner.current_latitude = lat.toString();
      partner.current_longitude = lng.toString();
      partner.status = Partner.Status.available;
      partner.idle_since = Date.now().toString();
      return partner;
    });
  };

  disconnect = async () => {
    await transaction(this.ref, (partner: Partner.Interface) => {
      if (partner == null) {
        return {};
      }
      partner.status = Partner.Status.unavailable;
      return partner;
    });
  };
}

export namespace Partner {
  export enum Status {
    available = "available",
    offline = "offline", // logged out or without internet
    unavailable = "unavailable",
    busy = "busy",
    requested = "requested",
  }

  export enum AccountStatus {
    pending_documents = "pending_documents",
    pending_review = "pending_review",
    granted_interview = "granted_interview",
    approved = "approved",
    denied_approval = "denied_approval",
    locked = "locked",
  }

  export interface DistanceToClient {
    distance_text: string;
    distance_value: number;
    duration_text: string;
    duration_value: number;
  }

  export enum Gender {
    masculino = "masculino",
    feminino = "feminino",
    outro = "outro",
  }

  export interface Interface {
    // these fields are created whenever a partner account is created
    uid: string;
    name: string;
    last_name: string;
    cpf: string;
    gender: Gender;
    phone_number: string;
    account_status: AccountStatus;
    // these fields are added as a partner's account_status progresses
    member_since?: string;
    current_client_uid?: string;
    current_latitude?: string;
    current_longitude?: string;
    current_zone?: ZoneName;
    status?: Status;
    vehicle?: Vehicle;
    idle_since?: string;
    rating?: string; // based on last 200 trips
    total_trips?: string; // incremented when partner completes a trip
    lock_reason?: string;
    score?: number; // not stored in database
    // TODO: change name to route or somethign
    distance_to_client?: DistanceToClient; // not stored in database
    submitted_documents?: SubmittedDocuments;
    bank_account?: AppBankAccount;
    pagarme_recipient_id?: string; // used to identify partner in pagarme API
    amount_owed?: number; // in cents. increased when partner handles trip paid in cash and decreased when paid in credit_card.
  }
  export namespace Interface {
    export const fromObj = (obj: any): Partner.Interface | undefined => {
      if (is(obj)) {
        // create partner obj, ignoring eventual extra irrelevant fields
        return {
          uid: obj.uid,
          name: obj.name,
          last_name: obj.last_name,
          cpf: obj.cpf,
          gender: obj.gender,
          member_since: obj.member_since,
          phone_number: obj.phone_number,
          current_client_uid: obj.current_client_uid,
          current_latitude: obj.current_latitude,
          current_longitude: obj.current_longitude,
          current_zone: obj.current_zone,
          status: obj.status,
          account_status: obj.account_status,
          vehicle: obj.vehicle,
          idle_since: obj.idle_since,
          rating: obj.rating,
          score: obj.score,
          lock_reason: obj.lock_reason,
          total_trips: obj.total_trips,
          submitted_documents: obj.submitted_documents,
          bank_account: obj.bank_account,
          pagarme_recipient_id: obj.pagarme_recipient_id,
          amount_owed: obj.amount_owed,
        };
      }
      return;
    };

    export const is = (obj: any): obj is Partner.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      if ("vehicle" in obj && !Vehicle.is(obj.vehicle)) {
        return false;
      }

      // type check optional submitted_documents
      if (
        "submitted_documents" in obj &&
        !SubmittedDocuments.is(obj.submitted_documents)
      ) {
        return false;
      }

      // type check optional bank_account
      if ("bank_account" in obj && !AppBankAccount.is(obj.bank_account)) {
        return false;
      }

      // type check optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("total_trips", "string") ||
        !typeCheckOptionalField("score", "number") ||
        !typeCheckOptionalField("pagarme_recipient_id", "string") ||
        !typeCheckOptionalField("amount_owed", "number") ||
        !typeCheckOptionalField("lock_reason", "string") ||
        !typeCheckOptionalField("member_since", "string") ||
        !typeCheckOptionalField("current_latitude", "string") ||
        !typeCheckOptionalField("current_longitude", "string") ||
        !typeCheckOptionalField("current_client_uid", "string") ||
        !typeCheckOptionalField("idle_since", "string") ||
        !typeCheckOptionalField("rating", "string")
      ) {
        return false;
      }

      return (
        "uid" in obj &&
        "name" in obj &&
        "last_name" in obj &&
        "cpf" in obj &&
        "gender" in obj &&
        "phone_number" in obj &&
        "account_status" in obj
      );
    };
  }

  export interface Vehicle {
    brand: string;
    model: string;
    year: number;
    plate: string;
  }

  export namespace Vehicle {
    export const is = (obj: any): obj is Vehicle => {
      if (obj == null || obj == undefined) {
        return false;
      }
      // make sure no invalid key is present
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "brand" &&
          keys[i] != "model" &&
          keys[i] != "year" &&
          keys[i] != "plate"
        ) {
          return false;
        }
      }

      return (
        "brand" in obj && "model" in obj && "year" in obj && "plate" in obj
      );
    };
  }

  export interface SubmittedDocuments {
    cnh?: boolean;
    crlv?: boolean;
    photo_with_cnh?: boolean;
    profile_photo?: boolean;
    bank_account?: boolean;
  }

  export namespace SubmittedDocuments {
    export const is = (obj: any): obj is SubmittedDocuments => {
      if (obj == null || obj == undefined) {
        return false;
      }
      // make sure no invalid key is present
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "cnh" &&
          keys[i] != "crlv" &&
          keys[i] != "photo_with_cnh" &&
          keys[i] != "profile_photo" &&
          keys[i] != "bank_account"
        ) {
          return false;
        }
      }

      // type check optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("cnh", "boolean") ||
        !typeCheckOptionalField("crlv", "boolean") ||
        !typeCheckOptionalField("photo_with_cnh", "boolean") ||
        !typeCheckOptionalField("profile_photo", "boolean") ||
        !typeCheckOptionalField("bank_account", "boolean")
      ) {
        return false;
      }

      return true;
    };
  }

  // optional fields are the ones populated when we
  // submit a request to create bank account in pagarme
  export interface AppBankAccount {
    id?: number;
    bank_code: string;
    agency: string;
    agency_dv?: string;
    account: string;
    account_dv: string;
    type: string;
    document_type?: string;
    document_number: string;
    legal_name: string;
    charge_transfer_fees?: boolean;
  }

  export namespace AppBankAccount {
    export const is = (obj: any): obj is AppBankAccount => {
      if (obj == null || obj == undefined) {
        return false;
      }
      // make sure no invalid key is present
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "id" &&
          keys[i] != "bank_code" &&
          keys[i] != "agency" &&
          keys[i] != "agency_dv" &&
          keys[i] != "account" &&
          keys[i] != "account_dv" &&
          keys[i] != "type" &&
          keys[i] != "document_type" &&
          keys[i] != "document_number" &&
          keys[i] != "legal_name" &&
          keys[i] != "charge_transfer_fees"
        ) {
          return false;
        }
      }

      // type check optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("id", "number") ||
        !typeCheckOptionalField("agency_dv", "string") ||
        !typeCheckOptionalField("document_type", "string") ||
        !typeCheckOptionalField("charge_transfer_fees", "boolean")
      ) {
        return false;
      }

      return (
        "bank_code" in obj &&
        "agency" in obj &&
        "account" in obj &&
        "account_dv" in obj &&
        "type" in obj &&
        "document_number" in obj &&
        "legal_name" in obj
      );
    };
  }
}
