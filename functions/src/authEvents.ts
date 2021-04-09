import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";

//clean user data whenever user is deleted
export const clean_user_data = functions.auth
  .user()
  .onDelete(
    async (user: functions.auth.UserRecord, _: functions.EventContext) => {
      // delete user's realtime database data
      const db = firebaseAdmin.database();
      await db.ref("trip-requests").child(user.uid).remove();
      await db.ref("users").child(user.uid).remove();

      // delete user's storage data
      const storage = firebaseAdmin.storage();
      await storage
        .bucket()
        .file("user-photos/" + user.uid + "/profile.jpg")
        .delete();
    }
  );

// create entry in database 'users' whenever a new user is added
export const create_user_data = functions.auth
  .user()
  .onCreate(
    (user: firebaseAdmin.auth.UserRecord, _: functions.EventContext) => {
      firebaseAdmin
        .database()
        .ref("users")
        .child(user.uid)
        .set({ past_trips: [] });
    }
  );
