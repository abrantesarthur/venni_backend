import { LatLngLiteral } from "@googlemaps/google-maps-services-js";

export enum LatLimit {
  highest = -17.200874,
  secondHighest = -17.20777,
  thirdHighest = -17.21405,
  fourthHighest = -17.219785,
  fifthHighest = -17.22606,
  sixthHighest = -17.232335,
  seventhHighest = -17.23861,
  eighthHighest = -17.244885,
  ninthHighest = -17.25116,
}

export enum LngLimit {
  highest = -46.8312,
  secondHighest = -46.846618,
  thirdHighest = -46.858181,
  fourthHighest = -46.869744,
  fifthHighest = -46.881307,
  sixthHighest = -46.89287,
  seventhHighest = -46.908288,
}

// enum AdjacencyLevel {
//   zero = 0,
//   one = 1,
//   two = 2,
//   three = 3,
// }

// class ZoneCoordinate {
//   lat: number;
//   lng: number;

//   constructor(lat: number, lng: number) {
//     this.lat = lat;
//     this.lng = lng;
//   }
// }

// class ZoneLimit {
//   nothEast: ZoneCoordinate;
//   southWest: ZoneCoordinate;

//   constructor(northEast: ZoneCoordinate, southWest: ZoneCoordinate) {
//     this.nothEast = northEast;
//     this.southWest = southWest;
//   }
// }

export enum ZoneName {
  AA = "AA",
  AB = "AB",
  AC = "AC",
  AD = "AD",
  BA = "BA",
  BB = "BB",
  BC = "BC",
  BD = "BD",
  CA = "CA",
  CB = "CB",
  CC = "CC",
  CD = "CD",
  DA = "DA",
  DB = "DB",
  DC = "DC",
  DD = "DD",
  EA = "EA",
  EB = "EB",
  EC = "EC",
  ED = "ED",
  FA = "FA",
  FB = "FB",
  FC = "FC",
  FD = "FD",
  GA = "GA",
  GB = "GB",
  GC = "GC",
  GD = "GD",
  HA = "HA",
  HB = "HB",
  HC = "HC",
  HD = "HD",
  NE = "NE",
  NW = "NW",
  SE = "SE",
  SW = "SW",
  UNDEFINED = "UNDEFINED",
}

const zoneNameFromString = (name: string): ZoneName => {
  switch (name) {
    case "AA":
      return ZoneName.AA;
    case "AB":
      return ZoneName.AB;
    case "AC":
      return ZoneName.AC;
    case "AD":
      return ZoneName.AD;
    case "BA":
      return ZoneName.BA;
    case "BB":
      return ZoneName.BB;
    case "BC":
      return ZoneName.BC;
    case "BD":
      return ZoneName.BD;
    case "CA":
      return ZoneName.CA;
    case "CB":
      return ZoneName.CB;
    case "CC":
      return ZoneName.CC;
    case "CD":
      return ZoneName.CD;
    case "DA":
      return ZoneName.DA;
    case "DB":
      return ZoneName.DB;
    case "DC":
      return ZoneName.DC;
    case "DD":
      return ZoneName.DD;
    case "EA":
      return ZoneName.EA;
    case "EB":
      return ZoneName.EB;
    case "EC":
      return ZoneName.EC;
    case "ED":
      return ZoneName.ED;
    case "FA":
      return ZoneName.FA;
    case "FB":
      return ZoneName.FB;
    case "FC":
      return ZoneName.FC;
    case "FD":
      return ZoneName.FD;
    case "GA":
      return ZoneName.GA;
    case "GB":
      return ZoneName.GB;
    case "GC":
      return ZoneName.GC;
    case "GD":
      return ZoneName.GD;
    case "HA":
      return ZoneName.HA;
    case "HB":
      return ZoneName.HB;
    case "HC":
      return ZoneName.HC;
    case "HD":
      return ZoneName.HD;
    case "NE":
      return ZoneName.NE;
    case "NW":
      return ZoneName.NW;
    case "SE":
      return ZoneName.SE;
    case "SW":
      return ZoneName.SW;
    default:
      return ZoneName.UNDEFINED;
  }
};

export class Zone {
  private _name: ZoneName;
  public get name() {
    return this._name;
  }

  public get isValid(): boolean {
    return this._name != null && this._name.length > 0;
  }

  // get a position and return the name of zone to which it belongs
  constructor(position: LatLngLiteral) {
    let name = "UNDEFINED";
    // calculate 'row' part of name
    if (
      position.lat <= LatLimit.highest &&
      position.lat > LatLimit.secondHighest
    ) {
      name = "A";
    } else if (
      position.lat <= LatLimit.secondHighest &&
      position.lat > LatLimit.thirdHighest
    ) {
      name = "B";
    } else if (
      position.lat <= LatLimit.thirdHighest &&
      position.lat > LatLimit.fourthHighest
    ) {
      name = "C";
    } else if (
      position.lat <= LatLimit.fourthHighest &&
      position.lat > LatLimit.fifthHighest
    ) {
      name = "D";
    } else if (
      position.lat <= LatLimit.fifthHighest &&
      position.lat > LatLimit.sixthHighest
    ) {
      name = "E";
    } else if (
      position.lat <= LatLimit.sixthHighest &&
      position.lat > LatLimit.seventhHighest
    ) {
      name = "F";
    } else if (
      position.lat <= LatLimit.seventhHighest &&
      position.lat > LatLimit.eighthHighest
    ) {
      name = "G";
    } else if (
      position.lat <= LatLimit.eighthHighest &&
      position.lat > LatLimit.ninthHighest
    ) {
      name = "H";
    }

    // calculate 'column' part of name
    if (
      position.lng <= LngLimit.highest &&
      position.lng > LngLimit.secondHighest
    ) {
      if (
        position.lat <= LatLimit.highest &&
        position.lat > LatLimit.fifthHighest
      ) {
        name = "NE"; // no
      } else if (
        position.lat <= LatLimit.fifthHighest &&
        position.lat > LatLimit.ninthHighest
      ) {
        name = "SE";
      } else {
        name = "UNDEFINED";
      }
    } else if (
      position.lng <= LngLimit.secondHighest &&
      position.lng > LngLimit.thirdHighest
    ) {
      name += "D";
    } else if (
      position.lng <= LngLimit.thirdHighest &&
      position.lng > LngLimit.fourthHighest
    ) {
      name += "C";
    } else if (
      position.lng <= LngLimit.fourthHighest &&
      position.lng > LngLimit.fifthHighest
    ) {
      name += "B";
    } else if (
      position.lng <= LngLimit.fifthHighest &&
      position.lng > LngLimit.sixthHighest
    ) {
      name += "A";
    } else if (
      position.lng <= LngLimit.sixthHighest &&
      position.lng > LngLimit.seventhHighest
    ) {
      if (
        position.lat <= LatLimit.highest &&
        position.lat > LatLimit.fifthHighest
      ) {
        name = "NW";
      } else if (
        position.lat <= LatLimit.fifthHighest &&
        position.lat > LatLimit.ninthHighest
      ) {
        name = "SW";
      } else {
        name = "UNDEFINED";
      }
    }

    this._name = zoneNameFromString(name);
  }

  // // getLimits returns the northeast and southwest coordinates of the zone
  // // depending on adjacentLevel. If adjacentLevel is 'zero', return the limits
  // // of the zone itself. If 'one', return the limits of the group comprising the zone
  // // and immediately adjacent zoens. If 'two', returs the limits of the group
  // // comprising the  zone, immediately adjacent zones, and secondarily adjacent zones.
  // // If 'four', return the limits of all zones
  // getLimits(zoneName: ZoneName, adjacentLevel: AdjacencyLevel): ZoneLimit {
  //   let firstLevelNorthEast: ZoneCoordinate; // north east border fo zone
  //   let secondLevelNorthEast: ZoneCoordinate; // north east border of adjacent zones
  //   let thirdLevelNorthEast: ZoneCoordinate; // north east border of second level adjacent zones
  //   let firstLevelSouthWest: ZoneCoordinate; // south west border of zone
  //   let secondLevelSouthWest: ZoneCoordinate; // south west border of adjacent zones
  //   let thirdLevelSouthWest: ZoneCoordinate; // south west border of second level zoens

  //   switch (zoneName) {
  //     case ZoneName.AA:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.sixthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.AB:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.AC:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fifthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.AD:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       break;
  //     case ZoneName.BA:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.sixthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.BB:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.BC:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.BD:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       break;
  //     case ZoneName.CA:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.thirdHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.CB:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.thirdHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.CC:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.CD:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.secondHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.highest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       break;
  //     case ZoneName.DA:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.thirdHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.seventhHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.DB:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.thirdHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.seventhHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.DC:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.seventhHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.DD:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.secondHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.secondHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.secondHighest,
  //         LngLimit.secondHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.thirdHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.seventhHighest,
  //         LngLimit.fifthHighest
  //       );
  //       break;
  //     case ZoneName.EA:
  //       firstLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fifthHighest,
  //         LngLimit.fifthHighest
  //       );
  //       secondLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.fourthHighest,
  //         LngLimit.fourthHighest
  //       );
  //       thirdLevelNorthEast = new ZoneCoordinate(
  //         LatLimit.thirdHighest,
  //         LngLimit.thirdHighest
  //       );
  //       firstLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.sixthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       secondLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.seventhHighest,
  //         LngLimit.sixthHighest
  //       );
  //       thirdLevelSouthWest = new ZoneCoordinate(
  //         LatLimit.eighthHighest,
  //         LngLimit.sixthHighest
  //       );
  //       break;
  //     case ZoneName.EB:
  //       break;
  //     case ZoneName.EC:
  //       break;
  //     case ZoneName.ED:
  //       break;
  //     case ZoneName.FA:
  //       break;
  //     case ZoneName.FB:
  //       break;
  //     case ZoneName.FC:
  //       break;
  //     case ZoneName.FD:
  //       break;
  //     case ZoneName.GA:
  //       break;
  //     case ZoneName.GB:
  //       break;
  //     case ZoneName.GC:
  //       break;
  //     case ZoneName.GD:
  //       break;
  //     case ZoneName.HA:
  //       break;
  //     case ZoneName.HB:
  //       break;
  //     case ZoneName.HC:
  //       break;
  //     case ZoneName.HD:
  //       break;
  //     case ZoneName.NE:
  //       break;
  //     case ZoneName.NW:
  //       break;
  //     case ZoneName.SE:
  //       break;
  //     case ZoneName.SW:
  //       break;
  //     default:
  //       return ZoneName.UNDEFINED;
  //   }
  // }
}
