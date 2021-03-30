import * as admin from "firebase-admin";
import { Request, Response, NextFunction } from "express";

export const authenticate = async function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const idToken = req.headers.authorization;
  if (!idToken) {
    return res
      .status(403)
      .json({ error_message: "Missing authentication credentials!" });
  }
  try {
    let decodedToken = await admin.auth().verifyIdToken(idToken);
    // pass user id to next handler
    req.body.uid = decodedToken.uid;
    return next();
  } catch (e) {
    return res.status(400).json(e);
  }
};
