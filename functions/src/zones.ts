/**
The city is divided into squares that are stored in the database.
As partners drive around, they send their new latitude and longitude
to the system every time they move 20 meters.
The system places them in the square to which they belong.
*/

export enum LatLimit {
  highest = -17.20116,
  secondHighest = -17.20616,
  thirdHighest = -17.21116,
  fourthHighest = -17.21616,
  fifthHighest = -17.22116,
  sixthHighest = -17.22616,
  seventhHighest = -17.23116,
  eighthHighest = -17.23616,
  ninthHighest = -17.24116,
  tenthHighest = -17.24616,
  eleventhHighest = -17.25116,
}

export enum LngLimit {
  highest = -46.8312,
  secondHighest = -46.839169,
  thirdHighest = -46.844169,
  fourthHighest = -46.849169,
  fifthHighest = -46.854169,
  sixthHighest = -46.859169,
  seventhHighest = -46.864169,
  eighthHighest = -46.869169,
  ninthHighest = -46.874169,
  tenthHighest = -46.879169,
  eleventhHighest = -46.884169,
  twelthHighest = -46.889169,
  thirtheenthHighest = -46.894169,
  fourteenthHighest = -46.899169,
  fifteenthHighest = -46.908288,
}

export enum ZoneName {
  AA = "AA",
  AB = "AB",
  AC = "AC",
  AD = "AD",
  AE = "AE",
  AF = "AF",
  AG = "AG",
  AH = "AH",
  AI = "AI",
  AJ = "AJ",
  AK = "AK",
  AL = "AL",
  BA = "BA",
  BB = "BB",
  BC = "BC",
  BD = "BD",
  BE = "BE",
  BF = "BF",
  BG = "BG",
  BH = "BH",
  BI = "BI",
  BJ = "BJ",
  BK = "BK",
  BL = "BL",
  CA = "CA",
  CB = "CB",
  CC = "CC",
  CD = "CD",
  CE = "CE",
  CF = "CF",
  CG = "CG",
  CH = "CH",
  CI = "CI",
  CJ = "CJ",
  CK = "CK",
  CL = "CL",
  DA = "DA",
  DB = "DB",
  DC = "DC",
  DD = "DD",
  DE = "DE",
  DF = "DF",
  DG = "DG",
  DH = "DH",
  DI = "DI",
  DJ = "DJ",
  DK = "DK",
  DL = "DL",
  EA = "EA",
  EB = "EB",
  EC = "EC",
  ED = "ED",
  EE = "EE",
  EF = "EF",
  EG = "EG",
  EH = "EH",
  EI = "EI",
  EJ = "EJ",
  EK = "EK",
  EL = "EL",
  FA = "FA",
  FB = "FB",
  FC = "FC",
  FD = "FD",
  FE = "FE",
  FF = "FF",
  FG = "FG",
  FH = "FH",
  FI = "FI",
  FJ = "FJ",
  FK = "FK",
  FL = "FL",
  GA = "GA",
  GB = "GB",
  GC = "GC",
  GD = "GD",
  GE = "GE",
  GF = "GF",
  GG = "GG",
  GH = "GH",
  GI = "GI",
  GJ = "GJ",
  GK = "GK",
  GL = "GL",
  HA = "HA",
  HB = "HB",
  HC = "HC",
  HD = "HD",
  HE = "HE",
  HF = "HF",
  HG = "HG",
  HH = "HH",
  HI = "HI",
  HJ = "HJ",
  HK = "HK",
  HL = "HL",
  IA = "IA",
  IB = "IB",
  IC = "IC",
  ID = "ID",
  IE = "IE",
  IF = "IF",
  IG = "IG",
  IH = "IH",
  II = "II",
  IJ = "IJ",
  IK = "IK",
  IL = "IL",
  JA = "JA",
  JB = "JB",
  JC = "JC",
  JD = "JD",
  JE = "JE",
  JF = "JF",
  JG = "JG",
  JH = "JH",
  JI = "JI",
  JJ = "JJ",
  JK = "JK",
  JL = "JL",
  NE = "NE",
  NW = "NW",
  SE = "SE",
  SW = "SW",
  UNDEFINED = "UNDEFINED",
}

export namespace ZoneName {
  export const is = (zn: string) => {
    for (var zoneName in ZoneName) {
      if (zoneName == zn) {
        return true;
      }
    }
    return false;
  };

  export const fromString = (name: string): ZoneName => {
    switch (name) {
      case "AA":
        return ZoneName.AA;
      case "AB":
        return ZoneName.AB;
      case "AC":
        return ZoneName.AC;
      case "AD":
        return ZoneName.AD;
      case "AE":
        return ZoneName.AE;
      case "AF":
        return ZoneName.AF;
      case "AG":
        return ZoneName.AG;
      case "AH":
        return ZoneName.AH;
      case "AI":
        return ZoneName.AI;
      case "AJ":
        return ZoneName.AJ;
      case "AK":
        return ZoneName.AK;
      case "AL":
        return ZoneName.AL;
      case "BA":
        return ZoneName.BA;
      case "BB":
        return ZoneName.BB;
      case "BC":
        return ZoneName.BC;
      case "BD":
        return ZoneName.BD;
      case "BE":
        return ZoneName.BE;
      case "BF":
        return ZoneName.BF;
      case "BG":
        return ZoneName.BG;
      case "BH":
        return ZoneName.BH;
      case "BI":
        return ZoneName.BI;
      case "BJ":
        return ZoneName.BJ;
      case "BK":
        return ZoneName.BK;
      case "BL":
        return ZoneName.BL;
      case "CA":
        return ZoneName.CA;
      case "CB":
        return ZoneName.CB;
      case "CC":
        return ZoneName.CC;
      case "CD":
        return ZoneName.CD;
      case "CE":
        return ZoneName.CE;
      case "CF":
        return ZoneName.CF;
      case "CG":
        return ZoneName.CG;
      case "CH":
        return ZoneName.CH;
      case "CI":
        return ZoneName.CI;
      case "CJ":
        return ZoneName.CJ;
      case "CK":
        return ZoneName.CK;
      case "CL":
        return ZoneName.CL;
      case "DA":
        return ZoneName.DA;
      case "DB":
        return ZoneName.DB;
      case "DC":
        return ZoneName.DC;
      case "DD":
        return ZoneName.DD;
      case "DE":
        return ZoneName.DE;
      case "DF":
        return ZoneName.DF;
      case "DG":
        return ZoneName.DG;
      case "DH":
        return ZoneName.DH;
      case "DI":
        return ZoneName.DI;
      case "DJ":
        return ZoneName.DJ;
      case "DK":
        return ZoneName.DK;
      case "DL":
        return ZoneName.DL;
      case "EA":
        return ZoneName.EA;
      case "EB":
        return ZoneName.EB;
      case "EC":
        return ZoneName.EC;
      case "ED":
        return ZoneName.ED;
      case "EE":
        return ZoneName.EE;
      case "EF":
        return ZoneName.EF;
      case "EG":
        return ZoneName.EG;
      case "EH":
        return ZoneName.EH;
      case "EI":
        return ZoneName.EI;
      case "EJ":
        return ZoneName.EJ;
      case "EK":
        return ZoneName.EK;
      case "EL":
        return ZoneName.EL;
      case "FA":
        return ZoneName.FA;
      case "FB":
        return ZoneName.FB;
      case "FC":
        return ZoneName.FC;
      case "FD":
        return ZoneName.FD;
      case "FE":
        return ZoneName.FE;
      case "FF":
        return ZoneName.FF;
      case "FG":
        return ZoneName.FG;
      case "FH":
        return ZoneName.FH;
      case "FI":
        return ZoneName.FI;
      case "FJ":
        return ZoneName.FJ;
      case "FK":
        return ZoneName.FK;
      case "FL":
        return ZoneName.FL;
      case "GA":
        return ZoneName.GA;
      case "GB":
        return ZoneName.GB;
      case "GC":
        return ZoneName.GC;
      case "GD":
        return ZoneName.GD;
      case "GE":
        return ZoneName.GE;
      case "GF":
        return ZoneName.GF;
      case "GG":
        return ZoneName.GG;
      case "GH":
        return ZoneName.GH;
      case "GI":
        return ZoneName.GI;
      case "GJ":
        return ZoneName.GJ;
      case "GK":
        return ZoneName.GK;
      case "GL":
        return ZoneName.GL;
      case "HA":
        return ZoneName.HA;
      case "HB":
        return ZoneName.HB;
      case "HC":
        return ZoneName.HC;
      case "HD":
        return ZoneName.HD;
      case "HE":
        return ZoneName.HE;
      case "HF":
        return ZoneName.HF;
      case "HG":
        return ZoneName.HG;
      case "HH":
        return ZoneName.HH;
      case "HI":
        return ZoneName.HI;
      case "HJ":
        return ZoneName.HJ;
      case "HK":
        return ZoneName.HK;
      case "HL":
        return ZoneName.HL;
      case "IA":
        return ZoneName.IA;
      case "IB":
        return ZoneName.IB;
      case "IC":
        return ZoneName.IC;
      case "ID":
        return ZoneName.ID;
      case "IE":
        return ZoneName.IE;
      case "IF":
        return ZoneName.IF;
      case "IG":
        return ZoneName.IG;
      case "IH":
        return ZoneName.IH;
      case "II":
        return ZoneName.II;
      case "IJ":
        return ZoneName.IJ;
      case "IK":
        return ZoneName.IK;
      case "IL":
        return ZoneName.IL;
      case "JA":
        return ZoneName.JA;
      case "JB":
        return ZoneName.JB;
      case "JC":
        return ZoneName.JC;
      case "JD":
        return ZoneName.JD;
      case "JE":
        return ZoneName.JE;
      case "JF":
        return ZoneName.JF;
      case "JG":
        return ZoneName.JG;
      case "JH":
        return ZoneName.JH;
      case "JI":
        return ZoneName.JI;
      case "JJ":
        return ZoneName.JJ;
      case "JK":
        return ZoneName.JK;
      case "JL":
        return ZoneName.JL;
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
}

export interface ZoneBounds {
  max_lat: number;
  min_lat: number;
  max_lng: number;
  min_lng: number;
}

export const getZoneBounds = (zoneName: ZoneName): ZoneBounds => {
  switch (zoneName) {
    case ZoneName.AA:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.AB:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.AC:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.AD:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.AE:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.AF:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.AG:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.AH:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.AI:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.AJ:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.AK:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.AL:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.secondHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.BA:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.BB:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.BC:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.BD:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.BE:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.BF:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.BG:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.BH:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.BI:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.BJ:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.BK:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.BL:
      return {
        max_lat: LatLimit.secondHighest,
        min_lat: LatLimit.thirdHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.CA:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.CB:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.CC:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.CD:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.CE:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.CF:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.CG:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.CH:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.CI:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.CJ:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.CK:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.CL:
      return {
        max_lat: LatLimit.thirdHighest,
        min_lat: LatLimit.fourthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.DA:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.DB:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.DC:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.DD:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.DE:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.DF:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.DG:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.DH:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.DI:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.DJ:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.DK:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.DL:
      return {
        max_lat: LatLimit.fourthHighest,
        min_lat: LatLimit.fifthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.EA:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.EB:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.EC:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.ED:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.EE:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.EF:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.EG:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.EH:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.EI:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.EJ:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.EK:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.EL:
      return {
        max_lat: LatLimit.fifthHighest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.FA:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.FB:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.FC:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.FD:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.FE:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.FF:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.FG:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.FH:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.FI:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.FJ:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.FK:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.FL:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.seventhHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.GA:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.GB:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.GC:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.GD:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.GE:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.GF:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.GG:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.GH:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.GI:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.GJ:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.GK:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.GL:
      return {
        max_lat: LatLimit.seventhHighest,
        min_lat: LatLimit.eighthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.HA:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.HB:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.HC:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.HD:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.HE:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.HF:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.HG:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.HH:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.HI:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.HJ:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.HK:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.HL:
      return {
        max_lat: LatLimit.eighthHighest,
        min_lat: LatLimit.ninthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.IA:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.IB:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.IC:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.ID:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.IE:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.IF:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.IG:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.IH:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.II:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.IJ:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.IK:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.IL:
      return {
        max_lat: LatLimit.ninthHighest,
        min_lat: LatLimit.tenthHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.JA:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.thirtheenthHighest,
        min_lng: LngLimit.fourteenthHighest,
      };
    case ZoneName.JB:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.twelthHighest,
        min_lng: LngLimit.thirtheenthHighest,
      };
    case ZoneName.JC:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.eleventhHighest,
        min_lng: LngLimit.twelthHighest,
      };
    case ZoneName.JD:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.tenthHighest,
        min_lng: LngLimit.eleventhHighest,
      };
    case ZoneName.JE:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.ninthHighest,
        min_lng: LngLimit.tenthHighest,
      };
    case ZoneName.JF:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.eighthHighest,
        min_lng: LngLimit.ninthHighest,
      };
    case ZoneName.JG:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.seventhHighest,
        min_lng: LngLimit.eighthHighest,
      };
    case ZoneName.JH:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.sixthHighest,
        min_lng: LngLimit.seventhHighest,
      };
    case ZoneName.JI:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.fifthHighest,
        min_lng: LngLimit.sixthHighest,
      };
    case ZoneName.JJ:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.fourthHighest,
        min_lng: LngLimit.fifthHighest,
      };
    case ZoneName.JK:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.thirdHighest,
        min_lng: LngLimit.fourthHighest,
      };
    case ZoneName.JL:
      return {
        max_lat: LatLimit.tenthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.secondHighest,
        min_lng: LngLimit.thirdHighest,
      };
    case ZoneName.NE:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.highest,
        min_lng: LngLimit.secondHighest,
      };
    case ZoneName.NW:
      return {
        max_lat: LatLimit.highest,
        min_lat: LatLimit.sixthHighest,
        max_lng: LngLimit.fourteenthHighest,
        min_lng: LngLimit.fifteenthHighest,
      };
    case ZoneName.SE:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.highest,
        min_lng: LngLimit.secondHighest,
      };
    case ZoneName.SW:
      return {
        max_lat: LatLimit.sixthHighest,
        min_lat: LatLimit.eleventhHighest,
        max_lng: LngLimit.fourteenthHighest,
        min_lng: LngLimit.fifteenthHighest,
      };
    default:
      return {
        max_lat: 0.0,
        min_lat: 0.0,
        max_lng: 0.0,
        min_lng: 0.0,
      };
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
    } else if (lat <= LatLimit.ninthHighest && lat > LatLimit.tenthHighest) {
      name = "I";
    } else if (lat <= LatLimit.tenthHighest && lat > LatLimit.eleventhHighest) {
      name = "J";
    }

    // calculate 'column' part of name
    if (lng <= LngLimit.highest && lng > LngLimit.secondHighest) {
      if (lat <= LatLimit.highest && lat > LatLimit.sixthHighest) {
        name = "NE"; // no
      } else if (
        lat <= LatLimit.sixthHighest &&
        lat > LatLimit.eleventhHighest
      ) {
        name = "SE";
      } else {
        name = "UNDEFINED";
      }
    } else if (lng <= LngLimit.secondHighest && lng > LngLimit.thirdHighest) {
      name += "L";
    } else if (lng <= LngLimit.thirdHighest && lng > LngLimit.fourthHighest) {
      name += "K";
    } else if (lng <= LngLimit.fourthHighest && lng > LngLimit.fifthHighest) {
      name += "J";
    } else if (lng <= LngLimit.fifthHighest && lng > LngLimit.sixthHighest) {
      name += "I";
    } else if (lng <= LngLimit.sixthHighest && lng > LngLimit.seventhHighest) {
      name += "H";
    } else if (lng <= LngLimit.seventhHighest && lng > LngLimit.eighthHighest) {
      name += "G";
    } else if (lng <= LngLimit.eighthHighest && lng > LngLimit.ninthHighest) {
      name += "F";
    } else if (lng <= LngLimit.ninthHighest && lng > LngLimit.tenthHighest) {
      name += "E";
    } else if (lng <= LngLimit.tenthHighest && lng > LngLimit.eleventhHighest) {
      name += "D";
    } else if (
      lng <= LngLimit.eleventhHighest &&
      lng > LngLimit.twelthHighest
    ) {
      name += "C";
    } else if (
      lng <= LngLimit.twelthHighest &&
      lng > LngLimit.thirtheenthHighest
    ) {
      name += "B";
    } else if (
      lng <= LngLimit.thirtheenthHighest &&
      lng > LngLimit.fourteenthHighest
    ) {
      name += "A";
    } else if (
      lng <= LngLimit.fourteenthHighest &&
      lng > LngLimit.fifteenthHighest
    ) {
      if (lat <= LatLimit.highest && lat > LatLimit.sixthHighest) {
        name = "NW";
      } else if (
        lat <= LatLimit.sixthHighest &&
        lat > LatLimit.eleventhHighest
      ) {
        name = "SW";
      } else {
        name = "UNDEFINED";
      }
    }
    return ZoneName.fromString(name);
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
      return [ZoneName.AC, ZoneName.AE, ZoneName.BC, ZoneName.BD, ZoneName.BE];
    case ZoneName.AE:
      return [ZoneName.AD, ZoneName.AF, ZoneName.BD, ZoneName.BE, ZoneName.BF];
    case ZoneName.AF:
      return [ZoneName.AE, ZoneName.AG, ZoneName.BE, ZoneName.BF, ZoneName.BG];
    case ZoneName.AG:
      return [ZoneName.AF, ZoneName.AH, ZoneName.BF, ZoneName.BG, ZoneName.BH];
    case ZoneName.AH:
      return [ZoneName.AG, ZoneName.AI, ZoneName.BG, ZoneName.BH, ZoneName.BI];
    case ZoneName.AI:
      return [ZoneName.AH, ZoneName.AJ, ZoneName.BH, ZoneName.BI, ZoneName.BJ];
    case ZoneName.AJ:
      return [ZoneName.AI, ZoneName.AK, ZoneName.BI, ZoneName.BJ, ZoneName.BK];
    case ZoneName.AK:
      return [ZoneName.AJ, ZoneName.AL, ZoneName.BJ, ZoneName.BK, ZoneName.BL];
    case ZoneName.AL:
      return [ZoneName.AK, ZoneName.BK, ZoneName.BL];
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
        ZoneName.AE,
        ZoneName.BC,
        ZoneName.BE,
        ZoneName.CC,
        ZoneName.CD,
        ZoneName.CE,
      ];
    case ZoneName.BE:
      return [
        ZoneName.AD,
        ZoneName.AE,
        ZoneName.AF,
        ZoneName.BD,
        ZoneName.BF,
        ZoneName.CD,
        ZoneName.CE,
        ZoneName.CF,
      ];
    case ZoneName.BF:
      return [
        ZoneName.AE,
        ZoneName.AF,
        ZoneName.AG,
        ZoneName.BE,
        ZoneName.BG,
        ZoneName.CE,
        ZoneName.CF,
        ZoneName.CG,
      ];
    case ZoneName.BG:
      return [
        ZoneName.AF,
        ZoneName.AG,
        ZoneName.AH,
        ZoneName.BF,
        ZoneName.BH,
        ZoneName.CF,
        ZoneName.CG,
        ZoneName.CH,
      ];
    case ZoneName.BH:
      return [
        ZoneName.AG,
        ZoneName.AH,
        ZoneName.AI,
        ZoneName.BG,
        ZoneName.BI,
        ZoneName.CG,
        ZoneName.CH,
        ZoneName.CI,
      ];
    case ZoneName.BI:
      return [
        ZoneName.AH,
        ZoneName.AI,
        ZoneName.AJ,
        ZoneName.BH,
        ZoneName.BJ,
        ZoneName.CH,
        ZoneName.CI,
        ZoneName.CJ,
      ];
    case ZoneName.BJ:
      return [
        ZoneName.AI,
        ZoneName.AJ,
        ZoneName.AK,
        ZoneName.BI,
        ZoneName.BK,
        ZoneName.CI,
        ZoneName.CJ,
        ZoneName.CK,
      ];
    case ZoneName.BK:
      return [
        ZoneName.AJ,
        ZoneName.AK,
        ZoneName.AL,
        ZoneName.BJ,
        ZoneName.BL,
        ZoneName.CJ,
        ZoneName.CK,
        ZoneName.CL,
      ];
    case ZoneName.BL:
      return [ZoneName.AK, ZoneName.AL, ZoneName.BK, ZoneName.CK, ZoneName.CL];
    case ZoneName.CA:
      return [ZoneName.BA, ZoneName.BB, ZoneName.CB, ZoneName.DA, ZoneName.DB];
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
        ZoneName.BE,
        ZoneName.CC,
        ZoneName.CE,
        ZoneName.DC,
        ZoneName.DD,
        ZoneName.DE,
      ];
    case ZoneName.CE:
      return [
        ZoneName.BD,
        ZoneName.BE,
        ZoneName.BF,
        ZoneName.CD,
        ZoneName.CF,
        ZoneName.DD,
        ZoneName.DE,
        ZoneName.DF,
      ];
    case ZoneName.CF:
      return [
        ZoneName.BE,
        ZoneName.BF,
        ZoneName.BG,
        ZoneName.CE,
        ZoneName.CG,
        ZoneName.DE,
        ZoneName.DF,
        ZoneName.DG,
      ];
    case ZoneName.CG:
      return [
        ZoneName.BF,
        ZoneName.BG,
        ZoneName.BH,
        ZoneName.CF,
        ZoneName.CH,
        ZoneName.DF,
        ZoneName.DG,
        ZoneName.DH,
      ];
    case ZoneName.CH:
      return [
        ZoneName.BG,
        ZoneName.BH,
        ZoneName.BI,
        ZoneName.CG,
        ZoneName.CI,
        ZoneName.DG,
        ZoneName.DH,
        ZoneName.DI,
      ];
    case ZoneName.CI:
      return [
        ZoneName.BH,
        ZoneName.BI,
        ZoneName.BJ,
        ZoneName.CH,
        ZoneName.CJ,
        ZoneName.DH,
        ZoneName.DI,
        ZoneName.DJ,
      ];
    case ZoneName.CJ:
      return [
        ZoneName.BI,
        ZoneName.BJ,
        ZoneName.BK,
        ZoneName.CI,
        ZoneName.CK,
        ZoneName.DI,
        ZoneName.DJ,
        ZoneName.DK,
      ];
    case ZoneName.CK:
      return [
        ZoneName.BJ,
        ZoneName.BK,
        ZoneName.BL,
        ZoneName.CJ,
        ZoneName.CL,
        ZoneName.DJ,
        ZoneName.DK,
        ZoneName.DL,
      ];
    case ZoneName.CL:
      return [ZoneName.BK, ZoneName.BL, ZoneName.CK, ZoneName.DK, ZoneName.DL];
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
        ZoneName.CE,
        ZoneName.DC,
        ZoneName.DE,
        ZoneName.EC,
        ZoneName.ED,
        ZoneName.EE,
      ];
    case ZoneName.DE:
      return [
        ZoneName.CD,
        ZoneName.CE,
        ZoneName.CF,
        ZoneName.DD,
        ZoneName.DF,
        ZoneName.ED,
        ZoneName.EE,
        ZoneName.EF,
      ];
    case ZoneName.DF:
      return [
        ZoneName.CE,
        ZoneName.CF,
        ZoneName.CG,
        ZoneName.DE,
        ZoneName.DG,
        ZoneName.EE,
        ZoneName.EF,
        ZoneName.EG,
      ];
    case ZoneName.DG:
      return [
        ZoneName.CF,
        ZoneName.CG,
        ZoneName.CH,
        ZoneName.DF,
        ZoneName.DH,
        ZoneName.EF,
        ZoneName.EG,
        ZoneName.EH,
      ];
    case ZoneName.DH:
      return [
        ZoneName.CG,
        ZoneName.CH,
        ZoneName.CI,
        ZoneName.DG,
        ZoneName.DI,
        ZoneName.EG,
        ZoneName.EH,
        ZoneName.EI,
      ];
    case ZoneName.DI:
      return [
        ZoneName.CH,
        ZoneName.CI,
        ZoneName.CJ,
        ZoneName.DH,
        ZoneName.DJ,
        ZoneName.EH,
        ZoneName.EI,
        ZoneName.EJ,
      ];
    case ZoneName.DJ:
      return [
        ZoneName.CI,
        ZoneName.CJ,
        ZoneName.CK,
        ZoneName.DI,
        ZoneName.DK,
        ZoneName.EI,
        ZoneName.EJ,
        ZoneName.EK,
      ];
    case ZoneName.DK:
      return [
        ZoneName.CJ,
        ZoneName.CK,
        ZoneName.CL,
        ZoneName.DJ,
        ZoneName.DL,
        ZoneName.EJ,
        ZoneName.EK,
        ZoneName.EL,
      ];
    case ZoneName.DL:
      return [ZoneName.CK, ZoneName.CL, ZoneName.DK, ZoneName.EK, ZoneName.EL];
    case ZoneName.EA:
      return [ZoneName.DA, ZoneName.DB, ZoneName.EB, ZoneName.FA, ZoneName.FB];
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
      return [
        ZoneName.DC,
        ZoneName.DD,
        ZoneName.DE,
        ZoneName.EC,
        ZoneName.EE,
        ZoneName.FC,
        ZoneName.FD,
        ZoneName.FE,
      ];
    case ZoneName.EE:
      return [
        ZoneName.DD,
        ZoneName.DE,
        ZoneName.DF,
        ZoneName.ED,
        ZoneName.EF,
        ZoneName.FD,
        ZoneName.FE,
        ZoneName.FF,
      ];
    case ZoneName.EF:
      return [
        ZoneName.DE,
        ZoneName.DF,
        ZoneName.DG,
        ZoneName.EE,
        ZoneName.EG,
        ZoneName.FE,
        ZoneName.FF,
        ZoneName.FG,
      ];
    case ZoneName.EG:
      return [
        ZoneName.DF,
        ZoneName.DG,
        ZoneName.DH,
        ZoneName.EF,
        ZoneName.EH,
        ZoneName.FF,
        ZoneName.FG,
        ZoneName.FH,
      ];
    case ZoneName.EH:
      return [
        ZoneName.DG,
        ZoneName.DH,
        ZoneName.DI,
        ZoneName.EG,
        ZoneName.EI,
        ZoneName.FG,
        ZoneName.FH,
        ZoneName.FI,
      ];
    case ZoneName.EI:
      return [
        ZoneName.DH,
        ZoneName.DI,
        ZoneName.DJ,
        ZoneName.EH,
        ZoneName.EJ,
        ZoneName.FH,
        ZoneName.FI,
        ZoneName.FJ,
      ];
    case ZoneName.EJ:
      return [
        ZoneName.DI,
        ZoneName.DJ,
        ZoneName.DK,
        ZoneName.EI,
        ZoneName.EK,
        ZoneName.FI,
        ZoneName.FJ,
        ZoneName.FK,
      ];
    case ZoneName.EK:
      return [
        ZoneName.DJ,
        ZoneName.DK,
        ZoneName.DL,
        ZoneName.EJ,
        ZoneName.EL,
        ZoneName.FJ,
        ZoneName.FK,
        ZoneName.FL,
      ];
    case ZoneName.EL:
      return [ZoneName.DK, ZoneName.DL, ZoneName.EK, ZoneName.FK, ZoneName.FL];
    case ZoneName.FA:
      return [ZoneName.EA, ZoneName.EB, ZoneName.FB, ZoneName.GA, ZoneName.GB];
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
      return [
        ZoneName.EC,
        ZoneName.ED,
        ZoneName.EE,
        ZoneName.FC,
        ZoneName.FE,
        ZoneName.GC,
        ZoneName.GD,
        ZoneName.GE,
      ];
    case ZoneName.FE:
      return [
        ZoneName.ED,
        ZoneName.EE,
        ZoneName.EF,
        ZoneName.FD,
        ZoneName.FF,
        ZoneName.GD,
        ZoneName.GE,
        ZoneName.GF,
      ];
    case ZoneName.FF:
      return [
        ZoneName.EE,
        ZoneName.EF,
        ZoneName.EG,
        ZoneName.FE,
        ZoneName.FG,
        ZoneName.GE,
        ZoneName.GF,
        ZoneName.GG,
      ];
    case ZoneName.FG:
      return [
        ZoneName.EF,
        ZoneName.EG,
        ZoneName.EH,
        ZoneName.FF,
        ZoneName.FH,
        ZoneName.GF,
        ZoneName.GG,
        ZoneName.GH,
      ];
    case ZoneName.FH:
      return [
        ZoneName.EG,
        ZoneName.EH,
        ZoneName.EI,
        ZoneName.FG,
        ZoneName.FI,
        ZoneName.GG,
        ZoneName.GH,
        ZoneName.GI,
      ];
    case ZoneName.FI:
      return [
        ZoneName.EH,
        ZoneName.EI,
        ZoneName.EJ,
        ZoneName.FH,
        ZoneName.FJ,
        ZoneName.GH,
        ZoneName.GI,
        ZoneName.GJ,
      ];
    case ZoneName.FJ:
      return [
        ZoneName.EI,
        ZoneName.EJ,
        ZoneName.EK,
        ZoneName.FI,
        ZoneName.FK,
        ZoneName.GI,
        ZoneName.GJ,
        ZoneName.GK,
      ];
    case ZoneName.FK:
      return [
        ZoneName.EJ,
        ZoneName.EK,
        ZoneName.EL,
        ZoneName.FJ,
        ZoneName.FL,
        ZoneName.GJ,
        ZoneName.GK,
        ZoneName.GL,
      ];
    case ZoneName.FL:
      return [ZoneName.EK, ZoneName.EL, ZoneName.FK, ZoneName.GK, ZoneName.GL];
    case ZoneName.GA:
      return [ZoneName.FA, ZoneName.FB, ZoneName.GB, ZoneName.HA, ZoneName.HB];
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
        ZoneName.FE,
        ZoneName.GC,
        ZoneName.GE,
        ZoneName.HC,
        ZoneName.HD,
        ZoneName.HE,
      ];
    case ZoneName.GE:
      return [
        ZoneName.FD,
        ZoneName.FE,
        ZoneName.FF,
        ZoneName.GD,
        ZoneName.GF,
        ZoneName.HD,
        ZoneName.HE,
        ZoneName.HF,
      ];
    case ZoneName.GF:
      return [
        ZoneName.FE,
        ZoneName.FF,
        ZoneName.FG,
        ZoneName.GE,
        ZoneName.GG,
        ZoneName.HE,
        ZoneName.HF,
        ZoneName.HG,
      ];
    case ZoneName.GG:
      return [
        ZoneName.FF,
        ZoneName.FG,
        ZoneName.FH,
        ZoneName.GF,
        ZoneName.GH,
        ZoneName.HF,
        ZoneName.HG,
        ZoneName.HH,
      ];
    case ZoneName.GH:
      return [
        ZoneName.FG,
        ZoneName.FH,
        ZoneName.FI,
        ZoneName.GG,
        ZoneName.GI,
        ZoneName.HG,
        ZoneName.HH,
        ZoneName.HI,
      ];
    case ZoneName.GI:
      return [
        ZoneName.FH,
        ZoneName.FI,
        ZoneName.FJ,
        ZoneName.GH,
        ZoneName.GJ,
        ZoneName.HH,
        ZoneName.HI,
        ZoneName.HJ,
      ];
    case ZoneName.GJ:
      return [
        ZoneName.FI,
        ZoneName.FJ,
        ZoneName.FK,
        ZoneName.GI,
        ZoneName.GK,
        ZoneName.HI,
        ZoneName.HJ,
        ZoneName.HK,
      ];
    case ZoneName.GK:
      return [
        ZoneName.FJ,
        ZoneName.FK,
        ZoneName.FL,
        ZoneName.GJ,
        ZoneName.GL,
        ZoneName.HJ,
        ZoneName.HK,
        ZoneName.HL,
      ];
    case ZoneName.GL:
      return [ZoneName.FK, ZoneName.FL, ZoneName.GK, ZoneName.HK, ZoneName.HL];
    case ZoneName.HA:
      return [ZoneName.GA, ZoneName.GB, ZoneName.HB, ZoneName.IA, ZoneName.IB];
    case ZoneName.HB:
      return [
        ZoneName.GA,
        ZoneName.GB,
        ZoneName.GC,
        ZoneName.HA,
        ZoneName.HC,
        ZoneName.IA,
        ZoneName.IB,
        ZoneName.IC,
      ];
    case ZoneName.HC:
      return [
        ZoneName.GB,
        ZoneName.GC,
        ZoneName.GD,
        ZoneName.HB,
        ZoneName.HC,
        ZoneName.IB,
        ZoneName.IC,
        ZoneName.ID,
      ];
    case ZoneName.HD:
      return [
        ZoneName.GC,
        ZoneName.GD,
        ZoneName.GE,
        ZoneName.HC,
        ZoneName.HE,
        ZoneName.IC,
        ZoneName.ID,
        ZoneName.IE,
      ];
    case ZoneName.HE:
      return [
        ZoneName.GD,
        ZoneName.GE,
        ZoneName.GF,
        ZoneName.HD,
        ZoneName.HF,
        ZoneName.ID,
        ZoneName.IE,
        ZoneName.IF,
      ];
    case ZoneName.HF:
      return [
        ZoneName.GE,
        ZoneName.GF,
        ZoneName.GG,
        ZoneName.HE,
        ZoneName.HG,
        ZoneName.IE,
        ZoneName.IF,
        ZoneName.IG,
      ];
    case ZoneName.HG:
      return [
        ZoneName.GF,
        ZoneName.GG,
        ZoneName.GH,
        ZoneName.HF,
        ZoneName.HH,
        ZoneName.IF,
        ZoneName.IG,
        ZoneName.IH,
      ];
    case ZoneName.HH:
      return [
        ZoneName.GG,
        ZoneName.GH,
        ZoneName.GI,
        ZoneName.HG,
        ZoneName.HI,
        ZoneName.IG,
        ZoneName.IH,
        ZoneName.II,
      ];
    case ZoneName.HI:
      return [
        ZoneName.GH,
        ZoneName.GI,
        ZoneName.GJ,
        ZoneName.HH,
        ZoneName.HJ,
        ZoneName.IH,
        ZoneName.II,
        ZoneName.IJ,
      ];
    case ZoneName.HJ:
      return [
        ZoneName.GI,
        ZoneName.GJ,
        ZoneName.GK,
        ZoneName.HI,
        ZoneName.HK,
        ZoneName.II,
        ZoneName.IJ,
        ZoneName.IK,
      ];
    case ZoneName.HK:
      return [
        ZoneName.GJ,
        ZoneName.GK,
        ZoneName.GL,
        ZoneName.HJ,
        ZoneName.HL,
        ZoneName.IJ,
        ZoneName.IK,
        ZoneName.IL,
      ];
    case ZoneName.HL:
      return [ZoneName.GK, ZoneName.GL, ZoneName.HK, ZoneName.IK, ZoneName.IL];
    case ZoneName.IA:
      return [ZoneName.HA, ZoneName.HB, ZoneName.IB, ZoneName.JA, ZoneName.JB];
    case ZoneName.IB:
      return [
        ZoneName.HA,
        ZoneName.HB,
        ZoneName.HC,
        ZoneName.IA,
        ZoneName.IC,
        ZoneName.JA,
        ZoneName.JB,
        ZoneName.JC,
      ];
    case ZoneName.IC:
      return [
        ZoneName.HB,
        ZoneName.HC,
        ZoneName.HD,
        ZoneName.IB,
        ZoneName.ID,
        ZoneName.JB,
        ZoneName.JC,
        ZoneName.JD,
      ];
    case ZoneName.ID:
      return [
        ZoneName.HC,
        ZoneName.HD,
        ZoneName.HE,
        ZoneName.IC,
        ZoneName.IE,
        ZoneName.JC,
        ZoneName.JD,
        ZoneName.JE,
      ];
    case ZoneName.IE:
      return [
        ZoneName.HD,
        ZoneName.HE,
        ZoneName.HF,
        ZoneName.ID,
        ZoneName.IF,
        ZoneName.JD,
        ZoneName.JE,
        ZoneName.JF,
      ];
    case ZoneName.IF:
      return [
        ZoneName.HE,
        ZoneName.HF,
        ZoneName.HG,
        ZoneName.IE,
        ZoneName.IG,
        ZoneName.JE,
        ZoneName.JF,
        ZoneName.JG,
      ];
    case ZoneName.IG:
      return [
        ZoneName.HF,
        ZoneName.HG,
        ZoneName.HH,
        ZoneName.IF,
        ZoneName.IH,
        ZoneName.JF,
        ZoneName.JG,
        ZoneName.JH,
      ];
    case ZoneName.IH:
      return [
        ZoneName.HG,
        ZoneName.HH,
        ZoneName.HI,
        ZoneName.IG,
        ZoneName.II,
        ZoneName.JG,
        ZoneName.JH,
        ZoneName.JI,
      ];
    case ZoneName.II:
      return [
        ZoneName.HH,
        ZoneName.HI,
        ZoneName.HJ,
        ZoneName.IH,
        ZoneName.IJ,
        ZoneName.JH,
        ZoneName.JI,
        ZoneName.JJ,
      ];
    case ZoneName.IJ:
      return [
        ZoneName.HI,
        ZoneName.HJ,
        ZoneName.HK,
        ZoneName.II,
        ZoneName.IK,
        ZoneName.JI,
        ZoneName.JJ,
        ZoneName.JK,
      ];
    case ZoneName.IK:
      return [
        ZoneName.HJ,
        ZoneName.HK,
        ZoneName.HL,
        ZoneName.IJ,
        ZoneName.IL,
        ZoneName.JJ,
        ZoneName.JK,
        ZoneName.JL,
      ];
    case ZoneName.IL:
      return [ZoneName.HK, ZoneName.HL, ZoneName.IK, ZoneName.JK, ZoneName.JL];
    case ZoneName.JA:
      return [ZoneName.IA, ZoneName.IB, ZoneName.JB];
    case ZoneName.JB:
      return [ZoneName.IA, ZoneName.IB, ZoneName.IC, ZoneName.JA, ZoneName.JC];
    case ZoneName.JC:
      return [ZoneName.IB, ZoneName.IC, ZoneName.IA, ZoneName.JB, ZoneName.JD];
    case ZoneName.JD:
      return [ZoneName.IC, ZoneName.ID, ZoneName.IE, ZoneName.JC, ZoneName.JE];
    case ZoneName.JE:
      return [ZoneName.ID, ZoneName.IE, ZoneName.IF, ZoneName.JD, ZoneName.JF];
    case ZoneName.JF:
      return [ZoneName.IE, ZoneName.IF, ZoneName.IG, ZoneName.JE, ZoneName.JG];
    case ZoneName.JG:
      return [ZoneName.IF, ZoneName.IG, ZoneName.IH, ZoneName.JF, ZoneName.JH];
    case ZoneName.JH:
      return [ZoneName.IG, ZoneName.IH, ZoneName.II, ZoneName.JG, ZoneName.JI];
    case ZoneName.JI:
      return [ZoneName.IH, ZoneName.II, ZoneName.IJ, ZoneName.JH, ZoneName.JJ];
    case ZoneName.JJ:
      return [ZoneName.II, ZoneName.IJ, ZoneName.IK, ZoneName.JI, ZoneName.JK];
    case ZoneName.JK:
      return [ZoneName.IJ, ZoneName.IK, ZoneName.IL, ZoneName.JJ, ZoneName.JL];
    case ZoneName.JL:
      return [ZoneName.IK, ZoneName.IL, ZoneName.JK];
    case ZoneName.NE:
      return [ZoneName.AA, ZoneName.BA, ZoneName.CA, ZoneName.DA, ZoneName.EA];
    case ZoneName.NW:
      return [ZoneName.AL, ZoneName.BL, ZoneName.CL, ZoneName.DL, ZoneName.EL];
    case ZoneName.SE:
      return [ZoneName.FA, ZoneName.GA, ZoneName.HA, ZoneName.IA, ZoneName.JA];
    case ZoneName.SW:
      return [ZoneName.FL, ZoneName.GL, ZoneName.HL, ZoneName.IL, ZoneName.JL];
    default:
      return [];
  }
};
