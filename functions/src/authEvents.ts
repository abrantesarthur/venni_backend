import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";

//clean user data whenever user is deleted
export const clean_user_data = functions.auth
  .user()
  .onDelete(
    async (user: functions.auth.UserRecord, _: functions.EventContext) => {
      // delete user's realtime database data
      const db = firebaseAdmin.database();

      // delete entry in 'trip-requests'
      await db.ref("trip-requests").child(user.uid).remove();
      // delete entry in users
      await db.ref("users").child(user.uid).remove();

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
