import { FunctionsErrorCode } from "firebase-functions/lib/providers/https";

export interface StandardError {
  code: FunctionsErrorCode;
  message: string;
}

export const treatDirectionsError = function (error: any): StandardError {
  if(error == undefined || error.response == undefined) {
    return {
      code: "unknown",
      message: "request to Google directions API failed.",
    };
  }
  let errorCode: FunctionsErrorCode;
  let errorMessage = error.response.data.error_message;
  switch (error.response.data.status) {
    case "NOT_FOUND": {
      errorCode = "not-found";
      break;
    }
    case "ZERO_RESULTS": {
      errorCode = "not-found";
      break;
    }
    case "INVALID_REQUEST": {
      errorCode = "invalid-argument";
      break;
    }
    default: {
      errorCode = "unknown";
      errorMessage = "request to Google directions API failed.";
      break;
    }
  }

  return {
    code: errorCode,
    message: errorMessage,
  };
};
