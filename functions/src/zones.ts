import { LatLngLiteral } from "@googlemaps/google-maps-services-js";

enum Lat {
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

enum Lng {
  highest = -46.8312,
  secondHighest = -46.846618,
  thirdHighest = -46.858181,
  fourthHighest = -46.869744,
  fifthHighest = -46.881307,
  sixthHighest = -46.89287,
  seventhHighest = -46.908288,
}

enum ZoneName {
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
  private name: ZoneName;

  isValid(): boolean {
    return this.name != null && this.name.length > 0;
  }

  // get a position and return the name of zone to which it belongs
  constructor(position: LatLngLiteral) {
    let name = "UNDEFINED";
    // calculate 'row' part of name
    if (position.lat <= Lat.highest && position.lat > Lat.secondHighest) {
      name = "A";
    } else if (
      position.lat <= Lat.secondHighest &&
      position.lat > Lat.thirdHighest
    ) {
      name = "B";
    } else if (
      position.lat <= Lat.thirdHighest &&
      position.lat > Lat.fourthHighest
    ) {
      name = "C";
    } else if (
      position.lat <= Lat.fourthHighest &&
      position.lat > Lat.fifthHighest
    ) {
      name = "D";
    } else if (
      position.lat <= Lat.fifthHighest &&
      position.lat > Lat.sixthHighest
    ) {
      name = "E";
    } else if (
      position.lat <= Lat.sixthHighest &&
      position.lat > Lat.seventhHighest
    ) {
      name = "F";
    } else if (
      position.lat <= Lat.seventhHighest &&
      position.lat > Lat.eighthHighest
    ) {
      name = "G";
    } else if (
      position.lat <= Lat.eighthHighest &&
      position.lat > Lat.ninthHighest
    ) {
      name = "H";
    }

    // calculate 'column' part of name
    if (position.lng <= Lng.highest && position.lng > Lng.secondHighest) {
      if (position.lat <= Lat.highest && position.lat > Lat.fifthHighest) {
        name = "NE"; // no
      } else if (
        position.lat <= Lat.fifthHighest &&
        position.lat > Lat.ninthHighest
      ) {
        name = "SE";
      } else {
        name = "UNDEFINED";
      }
    } else if (
      position.lng <= Lng.secondHighest &&
      position.lng > Lng.thirdHighest
    ) {
      name += "D";
    } else if (
      position.lng <= Lng.thirdHighest &&
      position.lng > Lng.fourthHighest
    ) {
      name += "C";
    } else if (
      position.lng <= Lng.fourthHighest &&
      position.lng > Lng.fifthHighest
    ) {
      name += "B";
    } else if (
      position.lng <= Lng.fifthHighest &&
      position.lng > Lng.sixthHighest
    ) {
      name += "A";
    } else if (
      position.lng <= Lng.sixthHighest &&
      position.lng > Lng.seventhHighest
    ) {
      if (position.lat <= Lat.highest && position.lat > Lat.fifthHighest) {
        name = "NW";
      } else if (
        position.lat <= Lat.fifthHighest &&
        position.lat > Lat.ninthHighest
      ) {
        name = "SW";
      } else {
        name = "UNDEFINED";
      }
    }

    this.name = zoneNameFromString(name);
  }
}
