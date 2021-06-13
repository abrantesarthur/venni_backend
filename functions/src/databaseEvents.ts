import { database, Change, EventContext } from "firebase-functions";
import { transaction } from "./database";
import { Partner } from "./database/partner";

export const update_partner_account_status = database
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

        // can only transition to pending_approval if status was pending_documents or denied_approval
        if (
          partner != undefined &&
          (partner.account_status == Partner.AccountStatus.pending_documents ||
            partner.account_status == Partner.AccountStatus.deniedApproval)
        ) {
          await transaction(p.ref, (partner: Partner.Interface) => {
            if (partner == null) {
              return {};
            }
            console.log(
              "switch account_status from " +
                partner.account_status +
                " to pending_approval"
            );
            partner.account_status = Partner.AccountStatus.pending_approval;
            return partner;
          });
        }
      }
    }
  );
