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
