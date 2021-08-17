import { ZoneName } from "../zones";
import { Database } from "./index";

export class DemandByZone extends Database {
  private readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("demand-by-zone");
  }

  // clear deletes all children in all zones
  clear = async () => {
    return await this.ref.remove();
  };

  // pushTripRequestTimestamp adds 'ts' to the list of timestamps in the path
  // demand-by-zone/{zoneName}. This represents the time at which a given trip
  // was requested by some client in the zone 'zoneName'. It is used to estimate
  // the trip demand in that partiular zone
  pushTripTimestampToZone = async (
    ts: number,
    zoneName: ZoneName
  ): Promise<any> => {
    return await this.ref.child(zoneName).push(ts);
  };

  // setTripTimestampsInZone updates 'zoneName' to contain 'tss'
  setTripTimestampsInZone = async (tss: Object, zoneName: ZoneName) => {
    return await this.ref.child(zoneName).set(tss);
  };

  getTripTimestampsFromZone = async (zoneName: ZoneName) => {
    return await this.ref.child(zoneName).once("value");
  };

  // getSnapshot returns a snapshot of the root the path.
  getSnapshot = async () => {
    return await this.ref.once("value");
  };

  // countTripRequestsByZone returns the number of trip timestamps in zoneName
  countTripRequestsByZone = async (): Promise<Map<ZoneName, number>> => {
    // initialize response
    let response = new Map<ZoneName, number>();
    for (var str in ZoneName) {
      response.set(ZoneName.fromString(str), 0);
    }

    // read root snapshot of 'demand-by-zone'
    let snapshot = await this.getSnapshot();

    // iterate over zones counting amount of trip requests there
    snapshot.forEach((zone) => {
      if (zone.key != null) {
        response.set(ZoneName.fromString(zone.key), zone.numChildren());
      }
    });

    return response;
  };
}
