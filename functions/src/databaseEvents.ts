import { database, Change, EventContext } from "firebase-functions";
import { transaction } from "./database";
import { Partner } from "./database/partner";
import { PartnersPendingReview } from "./database/partnersPendingReview";
import * as firebaseAdmin from "firebase-admin";
import { Pagarme } from "./vendors/pagarme";
import { Recipient } from "pagarme-js-types/src/client/recipients/responses";
import { LockedPartners } from "./database/lockedPartners";
import { getZoneNameFromCoordinate, ZoneName } from "./zones";
import { Client } from "./database/client";
import { client } from "pagarme";

// on_submitted_documents watches a partner's submitted documents. As
// soon as the partners submits all required documents for onboarding, the function
// updates theirs status to pending_review and adds them the to the list of partners
// to be reviewed
export const on_submitted_documents = database
  .ref("partners/{partnerID}/submitted_documents")
  .onWrite(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      // get most recent changes to submittedDocuments
      let submittedDocuments: Partner.SubmittedDocuments = change.after.val();

      console.log(submittedDocuments);

      // check whether the partner submitted all required documents
      if (
        submittedDocuments.cnh === true &&
        submittedDocuments.crlv === true &&
        submittedDocuments.photo_with_cnh == true &&
        submittedDocuments.profile_photo === true &&
        submittedDocuments.bank_account === true
      ) {
        console.log(
          "partner with ID " +
            context.params.partnerID +
            " has submitted all required documents."
        );
        // get a reference to the partner
        let p = new Partner(context.params.partnerID);
        let partner = await p.getPartner();

        console.log(
          "partner has account_status equal to " + partner?.account_status
        );

        // can only transition to pending_review if status was pending_documents or denied_approval
        if (
          partner != undefined &&
          (partner.account_status == Partner.AccountStatus.pending_documents ||
            partner.account_status == Partner.AccountStatus.denied_approval)
        ) {
          // switch account_status to pending_review
          await transaction(p.ref, (partner: Partner.Interface) => {
            if (partner == null) {
              return {};
            }
            console.log(
              "switch account_status from " +
                partner.account_status +
                " to pending_review"
            );
            partner.account_status = Partner.AccountStatus.pending_review;
            return partner;
          });

          // get partner email
          const partnerEmail = (await firebaseAdmin.auth().getUser(partner.uid))
            .email;

          try {
            console.log(
              "adding partner with uid  " +
                partner.uid +
                " to partners-pending-review list"
            );

            // add partner to list of pending review partners
            const ppr = new PartnersPendingReview();
            await ppr.set({
              uid: partner.uid,
              name: partner.name,
              last_name: partner.last_name,
              phone_number: partner.phone_number,
              email: partnerEmail,
            });
          } catch (e) {
            console.log(
              "failed to add partner with uid  " +
                partner.uid +
                " to partners-pending-review list: " +
                e
            );
          }
        }
      }
    }
  );

// on_account_status_change watches a partner's account_status. As soon as
// it switches from pending_review to either granted_interview or denied_approval,
// the function removes the partner from the pending review list
export const on_account_status_change = database
  .ref("partners/{partnerID}/account_status")
  .onWrite(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      const oldAccountStatus: Partner.AccountStatus = change.before.val();
      const newAccountStatus: Partner.AccountStatus = change.after.val();
      const partnerID = context.params.partnerID;
      console.log(
        "partner with uid " +
          partnerID +
          " had account_status transition from " +
          oldAccountStatus +
          " to " +
          newAccountStatus
      );

      // if partner's account_status transitioned from pending_review or denied_approval
      // to granted_interview or denied_approval
      if (
        (oldAccountStatus == Partner.AccountStatus.pending_review ||
          oldAccountStatus == Partner.AccountStatus.denied_approval) &&
        (newAccountStatus == Partner.AccountStatus.granted_interview ||
          newAccountStatus == Partner.AccountStatus.denied_approval)
      ) {
        console.log(
          "deleting partner with uid " + partnerID + " from pending review list"
        );

        // delete partner from pending review list
        try {
          const ppa = new PartnersPendingReview();
          await ppa.deleteByID(partnerID);
        } catch (e) {
          console.log(
            "failed to delete partner with uid " +
              partnerID +
              " from pending review list: " +
              e
          );
        }
      }

      // if partner's account_status transitioned from granted_interview to approved,
      // create a pagarme recipient ID and update partner with more information
      if (
        oldAccountStatus == Partner.AccountStatus.granted_interview &&
        newAccountStatus == Partner.AccountStatus.approved
      ) {
        // get partner data
        const p = new Partner(partnerID);
        const partner = await p.getPartner();
        const partnerAuth = await firebaseAdmin.auth().getUser(partnerID);
        const partnerEmail = partnerAuth.email;
        const partnerPhone = partnerAuth.phoneNumber;

        if (partner == undefined) {
          console.log("failed to get partner with uid " + partnerID);
          return;
        }
        if (partner.bank_account == undefined) {
          console.log("partner with uid " + partnerID + " has no bank account");
          return;
        }
        if (partner.bank_account.id == undefined) {
          console.log(
            "partner with uid " +
              partnerID +
              " has a bank account with undefined id"
          );
          return;
        }
        if (partnerEmail == undefined) {
          console.log("partner with UID " + partnerID + " has no email");
          return;
        }
        if (partnerPhone == undefined) {
          console.log("partner with UID " + partnerID + " has no phone number");
          return;
        }

        // create a pagarme recipient for the partner
        const pagarme = new Pagarme();
        await pagarme.ensureInitialized();
        let recipient: Recipient;
        try {
          /**
           * Partners receive bank transfers automatically and weekly on Thursdays.
           * Anticipations are also automatic and  happen daily on a D+15 model.
           * This means that, everyday, their available balance gets increased by
           * the amount anticipated that day, which refers to payments made 15 days prior.
           */
          recipient = await pagarme.createRecipient({
            transfer_enabled: true,
            transfer_interval: "weekly",
            transfer_day: "1",
            bank_account_id: partner.bank_account.id.toString(),
            automatic_anticipation_enabled: "true",
            automatic_anticipation_type: "1025",
            automatic_anticipation_days:
              "[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]",
            automatic_anticipation_1025_delay: "14",
            anticipatable_volume_percentage: "100",
            register_information: {
              type: "individual",
              document_number: partner.cpf,
              name: partner.name + " " + partner.last_name,
              email: partnerEmail,
              phone_numbers: [
                {
                  ddd: partnerPhone.substring(3, 5),
                  number: partnerPhone.substring(5),
                  type: "mobile",
                },
              ],
            },
            metadata: {},
          });
        } catch (e) {
          // on failure, lock partner's account
          console.log(
            "failed to create a pagarme recipient for partner with UID " +
              partnerID
          );
          console.log(e.response.errors[0]);
          await p.lockAccount(
            "failed to create pagarme recipient when 'account_status' transitioned to 'approved'"
          );
          return;
        }

        // populate partner with other relevant information
        try {
          const values: Object = {
            member_since: Date.now().toString(),
            rating: "5.0",
            total_trips: "0",
            status: "unavailable",
            current_client_uid: "",
            pagarme_recipient_id: recipient.id,
            amount_owed: 0,
          };
          await p.update(values);
        } catch (e) {
          // on failure, lock partner's account
          console.log("failed to update partner with UID " + partnerID);
          await p.lockAccount(
            "failed to add more info when 'account_status' transitioned to 'approved'"
          );
          return;
        }
      }

      // if account was locked, add partner to locked-partners list
      if (
        oldAccountStatus != Partner.AccountStatus.locked &&
        newAccountStatus == Partner.AccountStatus.locked
      ) {
        console.log("locked account of partner with uid " + partnerID);

        const p = new Partner(partnerID);
        const partner = await p.getPartner();
        if (partner == undefined) {
          return;
        }
        try {
          // add partner to locked account list
          const lp = new LockedPartners();
          await lp.set({
            uid: partner.uid,
            name: partner.name,
            cpf: partner.cpf,
            last_name: partner.last_name,
            phone_number: partner.phone_number,
            lock_reason: partner.lock_reason ?? "",
          });
          console.log(
            "added partner with uid " + partnerID + " to locked-partners list"
          );
        } catch (e) {
          console.log(
            "failed to add partner with uid " +
              partnerID +
              " to locked-partners: " +
              e
          );
        }
      }

      // if account was unlocked (but not deleted), remove partner from locked-partners list
      if (
        oldAccountStatus == Partner.AccountStatus.locked &&
        newAccountStatus != Partner.AccountStatus.locked &&
        newAccountStatus != null
      ) {
        console.log("unlocked account of partner with uid " + partnerID);

        try {
          // remove partner from locked-account list
          const lp = new LockedPartners();
          await lp.deleteByID(partnerID);
          console.log(
            "removed partner with uid " +
              partnerID +
              " from locked-partners list"
          );

          // unset partners's lock_reason
          const p = new Partner(partnerID);
          await p.update({ lock_reason: "" });
        } catch (e) {
          console.log(
            "failed to remove partner with uid " +
              partnerID +
              " from locked-partners: " +
              e
          );
        }
      }
    }
  );

// on_position_change gets triggered whenever the partner reports a new latitude and uses
// the new position to calculate and set the partner's current zone and to send notifications
// to the client when partner is nearby
export const on_position_change = database
  .ref("partners/{partnerID}/current_latitude")
  .onUpdate(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      // get partner so we can get longitude
      const partnerID = context.params.partnerID;
      const p = new Partner(partnerID);
      let partner;
      try {
        partner = await p.getPartner();
      } catch (e) {
        console.log("failed to get partner with uid " + partnerID);
        return;
      }

      if (partner != undefined) {
        // get coordiantes
        const newLng = partner.current_longitude;
        const newLat = change.after.val();

        if (newLng != undefined && newLat != undefined) {
          // calculate zone
          const zone = getZoneNameFromCoordinate(
            Number(newLat),
            Number(newLng)
          );

          // persist zone
          try {
            await p.update({ current_zone: zone });
          } catch (e) {
            console.log(
              "failed to update the zone of the partner with uid " + partnerID
            );
            return;
          }
        }
      }
    }
  );

export const on_partner_nearby = database
  .ref("trip-requests/{clientID}/partner_is_near")
  .onUpdate(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      const partnerIsNear: boolean = change.after.val();
      // notify client if partner is near
      if (partnerIsNear == true) {
        const c = new Client(context.params.clientID);
        const client = await c.getClient();
        if (
          client != undefined &&
          client.fcm_token != undefined &&
          client.fcm_token.length > 0
        ) {
          try {
            await firebaseAdmin.messaging().sendToDevice(client.fcm_token, {
              notification: {
                title: "Piloto próximo(a)",
                body: "Vá ao local de encontro",
                badge: "0",
                sound: "default",
              },
            });
          } catch (_) {}
        }
      }
    }
  );

// on_create_client adds the client's authenticaiton credentials to database
export const on_create_client = database
  .ref("clients/{clientID}")
  .onCreate(async (_: database.DataSnapshot, context: EventContext) => {
    const clientID = context.params.clientID;
    //
    const authClient = await firebaseAdmin.auth().getUser(clientID);
    await new Client(clientID).update({
      name: authClient.displayName?.split(" ")[0],
      last_name: authClient.displayName?.substring(
        authClient.displayName.indexOf(" ") + 1
      ),
      full_name: authClient.displayName,
      email: authClient.email,
      phone_number: authClient.phoneNumber,
    });
  });
