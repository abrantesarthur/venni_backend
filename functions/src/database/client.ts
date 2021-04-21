import { Database } from "./index";
import { TripRequest } from "./tripRequest";

export class Client extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("clients");
  }

  getReferenceByID = (id: string): Database.Reference => {
    return this.ref.child(id);
  };

  getClientByID = async (id: string): Promise<Client.Interface> => {
    const snapshot = await this.getReferenceByID(id).once("value");
    return snapshot.val() as Client.Interface;
  };

  getClientByReference = async (
    ref: Database.Reference
  ): Promise<Client.Interface> => {
    const snapshot = await ref.once("value");
    return snapshot.val() as Client.Interface;
  };
}

export namespace Client {
  export interface Interface {
    past_trips?: TripRequest.Interface[];
    total_trips: number;
    total_rating: number;
    rating: number;
  }
}
