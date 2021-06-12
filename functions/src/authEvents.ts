import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { Client } from "./database/client";

//clean user data whenever user is deleted
export const clean_user_data = functions.auth
  .user()
  .onDelete(
    async (user: functions.auth.UserRecord, _: functions.EventContext) => {
      // delete user's realtime database data
      const db = firebaseAdmin.database();

      // delete entry in 'trip-requests'
      await db.ref("trip-requests").child(user.uid).remove();
      // delete entry in clients
      await db.ref("clients").child(user.uid).remove();
      // delete entry in past-trips
      await db.ref("past-trips").child("clients").child(user.uid).remove();

      // delete storage data if it exists
      const getFilesResponse = await firebaseAdmin
        .storage()
        .bucket()
        .getFiles({
          prefix: "user-photos/" + user.uid,
        });
      getFilesResponse[0].forEach(async (file) => {
        await file.delete();
      });
    }
  );

//create entry on clients database whenever a new partner is created
export const create_client = functions.auth
  .user()
  .onCreate(
    async (user: functions.auth.UserRecord, _: functions.EventContext) => {
      // clients start out with a 5-star rating. After 5 trips, they start seeing
      // an average of their atual ratings.
      const client: Client.Interface = {
        uid: user.uid,
        payment_method: {
          default: "cash",
        },
        rating: "5",
      };

      // add client entry to database
      await firebaseAdmin.database().ref("clients").child(user.uid).set(client);
    }
  );
