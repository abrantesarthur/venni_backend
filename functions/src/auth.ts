import * as admin from "firebase-admin";
import { Request, Response, NextFunction } from "express";
import { JsonResponse } from "./httpInterfaces";

export const authenticate = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const idToken = req.headers.authorization;
  if (!idToken) {
    return res
      .status(401)
      .json(
        new JsonResponse(
          "REQUEST_DENIED",
          "Missing authentication credentials!"
        )
      );
  }
  // TODO: split token into Bearer and JWT before proceeding. This way we can check if token
  // is bearer and return error if not.
  try {
    let decodedToken = await admin.auth().verifyIdToken(idToken.replace("Bearer ", ""));
    // pass user id to next handler
    req.body.uid = decodedToken.uid;
    return next();
  } catch (e) {
    return res
      .status(401)
      .json(
        new JsonResponse(
          "UNAUTHENTICATED",
          "Failed to verify authentication token."
        )
      );
  }
};
