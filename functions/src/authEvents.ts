import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { ClientInterface } from "./interfaces";

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

//create entry on clients database whenever a new pilot is created
export const create_client = functions.auth
  .user()
  .onCreate(
    async (user: functions.auth.UserRecord, _: functions.EventContext) => {
      const client: ClientInterface = {
        past_trips: [],
        total_trips: 0,
        total_rating: 0,
        rating: 0,
      };

      // add client entry to database
      await firebaseAdmin.database().ref("clients").child(user.uid).set(client);
    }
  );
