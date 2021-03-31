export type JsonResponseStatus =
  | "OK"
  | "INVALID_REQUEST"
  | "REQUEST_DENIED"
  | "UNKNOWN_ERROR"
  | "UNAUTHENTICATED";

export class JsonResponse<T> {
  status: JsonResponseStatus;
  message?: string;
  result?: T;

  constructor(status: JsonResponseStatus, errorMessage?: string, result?: T) {
    this.status = status;
    this.message = errorMessage;
    this.result = result;
  }
}
