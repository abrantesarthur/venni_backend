import * as functions from "firebase-functions";
import * as express from "express";
import { Request, Response, NextFunction, RequestHandler } from "express";
import * as firebaseAdmin from "firebase-admin";
import { authenticate } from "./auth";
import { calculateFare } from "./fare";
import { Client, Language } from "@googlemaps/google-maps-services-js";

type JsonResponseStatus =
  | "OK"
  | "INVALID_REQUEST"
  | "REQUEST_DENIED"
  | "UNKNOWN_ERROR";

enum RideStatus {
  waitingConfirmation = "waiting-confirmation",
}

interface RideRequestInterface {
  uid: string;
  origin_place_id: string;
  destination_place_id: string;
}

interface RideResponseInterface {
  uid?: string;
  ride_status: RideStatus;
  origin_place_id: string;
  destination_place_id: string;
  fare_price: number;
  distance_meters: number;
  distance_text: string;
  duration_seconds: number;
  duration_text: string;
  encoded_points: string;
}

class JsonResponse {
  status: JsonResponseStatus;
  errorMessage?: string;
  result?: RideResponseInterface;

  constructor(
    status: JsonResponseStatus,
    errorMessage?: string,
    result?: RideResponseInterface
  ) {
    this.status = status;
    this.errorMessage = errorMessage;
    this.result = result;
  }
}

// initialize google maps API client
const googleMaps = new Client({});

// test that this works
const validateRequest: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // isRideRequest checks whether obj implements RideRequestInterface
  function isRideRequest(obj: any): obj is RideRequestInterface {
    return (
      typeof obj.uid === "string" &&
      typeof obj.origin_place_id === "string" &&
      typeof obj.destination_place_id == "string"
    );
  }
  // return error if req.body doesn't implement RideRequestInterface
  if (!isRideRequest(req.body)) {
    return res
      .status(400)
      .json(
        new JsonResponse(
          "INVALID_REQUEST",
          "Both origin_place_id and destination_place_id fields must be present in request body."
        )
      );
  }

  return next();
};

const requestRide = function () {
  // define the application
  const app = express();

  // define the db
  const db = firebaseAdmin.database();

  // add middlewares
  app.use(authenticate);
  app.use(express.json());
  app.use(validateRequest);

  // define post route
  app.post("/", async (req: Request, res: Response) => {
    // retrieve user id and request arguments
    const body = req.body as RideRequestInterface;

    // get a reference to user's ride request
    const rideRequestsRef = db.ref("ride-requests");
    const rideRequestRef = rideRequestsRef.child(body.uid);

    rideRequestRef.once("value", async (snapshot) => {
      if (snapshot.val() != null) {
        // if a a ride request already exists for the user, return REQUEST_DENIED
        return res
          .status(200)
          .json(
            new JsonResponse(
              "REQUEST_DENIED",
              "The user already has an active ride request"
            )
          );
      }

      // otherwise, request directions API for further route information
      let directionsResponse;
      try {
        directionsResponse = await googleMaps.directions({
          params: {
            key: functions.config().googleapi.key,
            origin: "place_id:" + body.origin_place_id,
            destination: "place_id:" + body.destination_place_id,
            language: Language.pt_BR,
          },
        });
      } catch (e) {
        return res
          .status(500)
          .json(
            new JsonResponse(
              "UNKNOWN_ERROR",
              "Something wrong happened.Try again later."
            )
          );
      }

      // create a ride request entry in the database
      const route = directionsResponse.data.routes[0];
      const result: RideResponseInterface = {
        ride_status: RideStatus.waitingConfirmation,
        origin_place_id: body.origin_place_id,
        destination_place_id: body.destination_place_id,
        fare_price: calculateFare(route.legs[0].distance.value),
        distance_meters: route.legs[0].distance.value,
        distance_text: route.legs[0].distance.text,
        duration_seconds: route.legs[0].duration.value,
        duration_text: route.legs[0].duration.text,
        encoded_points: route.overview_polyline.points,
      };
      await rideRequestRef.set(result);

      // enrich result with uid and return it.
      result.uid = body.uid;
      return res.status(200).json(new JsonResponse("OK", undefined, result));
    });
  });

  return app;
};

// TODO: don't forget to remove ride-request once it is finished

const confirmRide = function () {
  const app = express();

  app.use(authenticate);

  app.get("/", (req, res) => {
    return res.status(200).json({ message: "oK" });
  });

  return app;
};

exports.request = functions.https.onRequest(requestRide());
exports.confirm = functions.https.onRequest(confirmRide());

/**
 * TESTS
 *  1) if user already has an active ride request, return "REQUEST_DENIED"
 *  2) request wiht missing body fields receive "INVALID_REQUEST"
 */
