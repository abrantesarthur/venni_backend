import { Database } from ".";

// TODO: test
export class LockedPartners extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("locked-partners");
  }

  set = async (partner: LockedPartners.Interface) => {
    await this.ref.child(partner.uid).set(partner);
  };

  getByID = async (
    partnerID: string
  ): Promise<LockedPartners.Interface | undefined> => {
    const snapshot = await this.ref.child(partnerID).once("value");
    return LockedPartners.Interface.fromObj(snapshot.val());
  };

  deleteByID = async (partnerID: string): Promise<any> => {
    return await this.ref.child(partnerID).remove();
  };
}

export namespace LockedPartners {
  export interface Interface {
    uid: string;
    name: string;
    last_name: string;
    phone_number: string;
  }
  export namespace Interface {
    export const fromObj = (obj: any): LockedPartners.Interface | undefined => {
      if (is(obj)) {
        return {
          uid: obj.uid,
          name: obj.name,
          last_name: obj.last_name,
          phone_number: obj.phone_number,
        };
      }
      return;
    };

    export const is = (obj: any): obj is LockedPartners.Interface => {
      return (
        "uid" in obj &&
        "name" in obj &&
        "last_name" in obj &&
        "phone_number" in obj
      );
    };
  }
}
