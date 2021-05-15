/**
The city is divided into squares that are stored in the database.
As pilots drive around, they send their new latitude and longitude
to the system every time they move 100 meters.
The system places them in the square to which they belong.
*/

import { namespace } from "firebase-functions/lib/providers/firestore";

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

export namespace ZoneName {
  export const is = (zn: string) => {
    return (
      zn == "AA" ||
      zn == "AB" ||
      zn == "AC" ||
      zn == "AD" ||
      zn == "BA" ||
      zn == "BB" ||
      zn == "BC" ||
      zn == "BD" ||
      zn == "CA" ||
      zn == "CB" ||
      zn == "CC" ||
      zn == "CD" ||
      zn == "DA" ||
      zn == "DB" ||
      zn == "DC" ||
      zn == "DD" ||
      zn == "EA" ||
      zn == "EB" ||
      zn == "EC" ||
      zn == "ED" ||
      zn == "FA" ||
      zn == "FB" ||
      zn == "FC" ||
      zn == "FD" ||
      zn == "GA" ||
      zn == "GB" ||
      zn == "GC" ||
      zn == "GD" ||
      zn == "HA" ||
      zn == "HB" ||
      zn == "HC" ||
      zn == "HD" ||
      zn == "NE" ||
      zn == "NW" ||
      zn == "SE" ||
      zn == "SW"
    );
  };
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

export const getZoneNameFromCoordinate = (
  lat: number,
  lng: number
): ZoneName => {
  {
    let name = "UNDEFINED";
    // calculate 'row' part of name
    if (lat <= LatLimit.highest && lat > LatLimit.secondHighest) {
      name = "A";
    } else if (lat <= LatLimit.secondHighest && lat > LatLimit.thirdHighest) {
      name = "B";
    } else if (lat <= LatLimit.thirdHighest && lat > LatLimit.fourthHighest) {
      name = "C";
    } else if (lat <= LatLimit.fourthHighest && lat > LatLimit.fifthHighest) {
      name = "D";
    } else if (lat <= LatLimit.fifthHighest && lat > LatLimit.sixthHighest) {
      name = "E";
    } else if (lat <= LatLimit.sixthHighest && lat > LatLimit.seventhHighest) {
      name = "F";
    } else if (lat <= LatLimit.seventhHighest && lat > LatLimit.eighthHighest) {
      name = "G";
    } else if (lat <= LatLimit.eighthHighest && lat > LatLimit.ninthHighest) {
      name = "H";
    }

    // calculate 'column' part of name
    if (lng <= LngLimit.highest && lng > LngLimit.secondHighest) {
      if (lat <= LatLimit.highest && lat > LatLimit.fifthHighest) {
        name = "NE"; // no
      } else if (lat <= LatLimit.fifthHighest && lat > LatLimit.ninthHighest) {
        name = "SE";
      } else {
        name = "UNDEFINED";
      }
    } else if (lng <= LngLimit.secondHighest && lng > LngLimit.thirdHighest) {
      name += "D";
    } else if (lng <= LngLimit.thirdHighest && lng > LngLimit.fourthHighest) {
      name += "C";
    } else if (lng <= LngLimit.fourthHighest && lng > LngLimit.fifthHighest) {
      name += "B";
    } else if (lng <= LngLimit.fifthHighest && lng > LngLimit.sixthHighest) {
      name += "A";
    } else if (lng <= LngLimit.sixthHighest && lng > LngLimit.seventhHighest) {
      if (lat <= LatLimit.highest && lat > LatLimit.fifthHighest) {
        name = "NW";
      } else if (lat <= LatLimit.fifthHighest && lat > LatLimit.ninthHighest) {
        name = "SW";
      } else {
        name = "UNDEFINED";
      }
    }
    return zoneNameFromString(name);
  }
};

// getLimits returns the northeast and southwest coordinates of the zone
// depending on adjacentLevel. If adjacentLevel is 'zero', return the limits
// of the zone itself. If 'one', return the limits of the group comprising the zone
// and immediately adjacent zoens. If 'two', returs the limits of the group
// comprising the  zone, immediately adjacent zones, and secondarily adjacent zones.
// If 'four', return the limits of all zones
export const getZonesAdjacentTo = (zoneName: ZoneName): ZoneName[] => {
  switch (zoneName) {
    case ZoneName.AA:
      return [ZoneName.AB, ZoneName.BA, ZoneName.BB];
    case ZoneName.AB:
      return [ZoneName.AA, ZoneName.AC, ZoneName.BA, ZoneName.BB, ZoneName.BC];
    case ZoneName.AC:
      return [ZoneName.AB, ZoneName.AD, ZoneName.BB, ZoneName.BC, ZoneName.BD];
    case ZoneName.AD:
      return [ZoneName.AC, ZoneName.BC, ZoneName.BD];
    case ZoneName.BA:
      return [ZoneName.AA, ZoneName.AB, ZoneName.BB, ZoneName.CA, ZoneName.CB];
    case ZoneName.BB:
      return [
        ZoneName.AA,
        ZoneName.AB,
        ZoneName.AC,
        ZoneName.BA,
        ZoneName.BC,
        ZoneName.CA,
        ZoneName.CB,
        ZoneName.CC,
      ];
    case ZoneName.BC:
      return [
        ZoneName.AB,
        ZoneName.AC,
        ZoneName.AD,
        ZoneName.BB,
        ZoneName.BD,
        ZoneName.CB,
        ZoneName.CC,
        ZoneName.CD,
      ];
    case ZoneName.BD:
      return [
        ZoneName.AC,
        ZoneName.AD,
        ZoneName.BC,
        ZoneName.NE,
        ZoneName.CC,
        ZoneName.CD,
      ];
    case ZoneName.CA:
      return [
        ZoneName.BA,
        ZoneName.BB,
        ZoneName.NE,
        ZoneName.CB,
        ZoneName.DA,
        ZoneName.DD,
      ];
    case ZoneName.CB:
      return [
        ZoneName.BA,
        ZoneName.BB,
        ZoneName.BC,
        ZoneName.CA,
        ZoneName.CC,
        ZoneName.DA,
        ZoneName.DB,
        ZoneName.DC,
      ];
    case ZoneName.CC:
      return [
        ZoneName.BB,
        ZoneName.BC,
        ZoneName.BD,
        ZoneName.CB,
        ZoneName.CD,
        ZoneName.DB,
        ZoneName.DC,
        ZoneName.DD,
      ];
    case ZoneName.CD:
      return [
        ZoneName.BC,
        ZoneName.BD,
        ZoneName.CC,
        ZoneName.NE,
        ZoneName.DC,
        ZoneName.DD,
      ];
    case ZoneName.DA:
      return [ZoneName.CA, ZoneName.CB, ZoneName.DB, ZoneName.EA, ZoneName.EB];
    case ZoneName.DB:
      return [
        ZoneName.CA,
        ZoneName.CB,
        ZoneName.CC,
        ZoneName.DA,
        ZoneName.DC,
        ZoneName.EA,
        ZoneName.EB,
        ZoneName.EC,
      ];
    case ZoneName.DC:
      return [
        ZoneName.CB,
        ZoneName.CC,
        ZoneName.CD,
        ZoneName.DB,
        ZoneName.DD,
        ZoneName.EB,
        ZoneName.EC,
        ZoneName.ED,
      ];
    case ZoneName.DD:
      return [
        ZoneName.CC,
        ZoneName.CD,
        ZoneName.DC,
        ZoneName.NE,
        ZoneName.EC,
        ZoneName.ED,
      ];
    case ZoneName.EA:
      return [
        ZoneName.DA,
        ZoneName.DB,
        ZoneName.EB,
        ZoneName.FA,
        ZoneName.FB,
        ZoneName.SW,
      ];
    case ZoneName.EB:
      return [
        ZoneName.DA,
        ZoneName.DB,
        ZoneName.DC,
        ZoneName.EA,
        ZoneName.EC,
        ZoneName.FA,
        ZoneName.FB,
        ZoneName.FC,
      ];
    case ZoneName.EC:
      return [
        ZoneName.DB,
        ZoneName.DC,
        ZoneName.DD,
        ZoneName.EB,
        ZoneName.ED,
        ZoneName.FB,
        ZoneName.FC,
        ZoneName.FD,
      ];
    case ZoneName.ED:
      return [ZoneName.DC, ZoneName.DD, ZoneName.EC, ZoneName.FC, ZoneName.FD];
    case ZoneName.FA:
      return [
        ZoneName.EA,
        ZoneName.EB,
        ZoneName.FB,
        ZoneName.GA,
        ZoneName.GB,
        ZoneName.SW,
      ];
    case ZoneName.FB:
      return [
        ZoneName.EA,
        ZoneName.EB,
        ZoneName.EC,
        ZoneName.FA,
        ZoneName.FC,
        ZoneName.GA,
        ZoneName.GB,
        ZoneName.GC,
      ];
    case ZoneName.FC:
      return [
        ZoneName.EB,
        ZoneName.EC,
        ZoneName.ED,
        ZoneName.FB,
        ZoneName.FD,
        ZoneName.GB,
        ZoneName.GC,
        ZoneName.GD,
      ];
    case ZoneName.FD:
      return [ZoneName.EC, ZoneName.ED, ZoneName.FC, ZoneName.GC, ZoneName.GD];
    case ZoneName.GA:
      return [
        ZoneName.FA,
        ZoneName.FB,
        ZoneName.SW,
        ZoneName.GB,
        ZoneName.HA,
        ZoneName.HB,
      ];
    case ZoneName.GB:
      return [
        ZoneName.FA,
        ZoneName.FB,
        ZoneName.FC,
        ZoneName.GA,
        ZoneName.GC,
        ZoneName.HA,
        ZoneName.HB,
        ZoneName.HC,
      ];
    case ZoneName.GC:
      return [
        ZoneName.FB,
        ZoneName.FC,
        ZoneName.FD,
        ZoneName.GB,
        ZoneName.GD,
        ZoneName.HB,
        ZoneName.HC,
        ZoneName.HD,
      ];
    case ZoneName.GD:
      return [
        ZoneName.FC,
        ZoneName.FD,
        ZoneName.GC,
        ZoneName.SE,
        ZoneName.HC,
        ZoneName.HD,
      ];
    case ZoneName.HA:
      return [ZoneName.GA, ZoneName.GB, ZoneName.HB];
    case ZoneName.HB:
      return [ZoneName.GA, ZoneName.GB, ZoneName.GC, ZoneName.HA, ZoneName.HC];
    case ZoneName.HC:
      return [ZoneName.GB, ZoneName.GC, ZoneName.GD, ZoneName.HB, ZoneName.HD];
    case ZoneName.HD:
      return [ZoneName.GC, ZoneName.GD, ZoneName.HC];
    case ZoneName.NW:
      return [ZoneName.AA, ZoneName.BA, ZoneName.CA, ZoneName.DA];
    case ZoneName.NE:
      return [ZoneName.AD, ZoneName.BD, ZoneName.CD, ZoneName.DD];
    case ZoneName.SW:
      return [ZoneName.EA, ZoneName.FA, ZoneName.GA, ZoneName.HA];
    case ZoneName.SE:
      return [ZoneName.ED, ZoneName.FD, ZoneName.GD, ZoneName.HD];
    default:
      return [];
  }
};
