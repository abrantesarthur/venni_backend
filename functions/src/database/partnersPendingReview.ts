import { Database } from ".";

// TODO: test
export class PartnersPendingReview extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("partners-pending-review");
  }

  set = async (partner: PartnersPendingReview.Interface) => {
    await this.ref.child(partner.uid).set(partner);
  };

  getByID = async (
    partnerID: string
  ): Promise<PartnersPendingReview.Interface | undefined> => {
    const snapshot = await this.ref.child(partnerID).once("value");
    return PartnersPendingReview.Interface.fromObj(snapshot.val());
  };

  deleteByID = async (partnerID: string): Promise<any> => {
    return await this.ref.child(partnerID).remove();
  };
}

export namespace PartnersPendingReview {
  export interface Interface {
    // these fields are created whenever a partner account is created
    uid: string;
    name: string;
    last_name: string;
    phone_number: string;
    email?: string;
  }
  export namespace Interface {
    export const fromObj = (
      obj: any
    ): PartnersPendingReview.Interface | undefined => {
      if (is(obj)) {
        return {
          uid: obj.uid,
          name: obj.name,
          last_name: obj.last_name,
          phone_number: obj.phone_number,
          email: obj.email,
        };
      }
      return;
    };

    export const is = (obj: any): obj is PartnersPendingReview.Interface => {
      return (
        "uid" in obj &&
        "name" in obj &&
        "last_name" in obj &&
        "phone_number" in obj
      );
    };
  }
}
