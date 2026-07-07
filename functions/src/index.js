const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const APPROVAL_DELAY_MS = 5000;
const INSURANCE_EMAIL = 'fatuma.omar@strathmore.edu';

/**
 * Callable Cloud Function: insuranceApproval
 *
 * Called by the receptionist dashboard when an insurance payment is processed.
 * 1. Sends an approval request email to the designated testing address.
 * 2. Auto-approves after a delay (demo automation).
 * 3. Updates the Firestore payment document with the approval status.
 */
exports.insuranceApproval = onCall(
  { cors: true, region: 'us-central1' },
  async (request) => {
    const {
      paymentId,
      patientName,
      insuranceProvider,
      insuranceNumber,
      amount,
    } = request.data;

    if (!paymentId) {
      throw new HttpsError('invalid-argument', 'paymentId is required');
    }

    logger.info(`Insurance approval requested for payment ${paymentId}`, {
      patientName,
      insuranceProvider,
      amount,
    });

    // 1. Log the approval request email (in production, send via SendGrid/Resend)
    const requestEmailBody = `
      Insurance Approval Request
      ---------------------------
      Patient: ${patientName || 'Unknown'}
      Insurance Provider: ${insuranceProvider || 'N/A'}
      Insurance Number: ${insuranceNumber || 'N/A'}
      Amount: KES ${amount || 0}
      Payment ID: ${paymentId}

      This is an automated demo email sent to ${INSURANCE_EMAIL}.
      The system will auto-approve this request in ${APPROVAL_DELAY_MS / 1000} seconds.
    `;
    logger.info(`[INSURANCE EMAIL] To: ${INSURANCE_EMAIL}`);
    logger.info(`[INSURANCE EMAIL] Subject: Insurance Approval Request - ${patientName}`);
    logger.info(`[INSURANCE EMAIL] Body: ${requestEmailBody}`);

    // 2. Auto-approve after a delay (simulates insurance company response)
    setTimeout(async () => {
      try {
        // Update the Firestore payment document with approval status
        await db.collection('payments').doc(paymentId).update({
          insuranceStatus: 'Approved',
        });

        const approvalEmailBody = `
          Insurance APPROVED
          ------------------
          Patient: ${patientName || 'Unknown'}
          Provider: ${insuranceProvider || 'N/A'}
          Amount: KES ${amount || 0}
          Status: APPROVED

          The patient's journey can now proceed.
        `;
        logger.info(`[INSURANCE APPROVAL] Auto-approved for payment ${paymentId}`);
        logger.info(`[INSURANCE APPROVAL] Approval email sent to ${INSURANCE_EMAIL}`);
        logger.info(`[INSURANCE APPROVAL] Body: ${approvalEmailBody}`);
      } catch (err) {
        logger.error('Auto-approval error:', err);
      }
    }, APPROVAL_DELAY_MS);

    return {
      success: true,
      message: `Insurance approval email sent to ${INSURANCE_EMAIL}. Auto-approval will arrive in ${APPROVAL_DELAY_MS / 1000} seconds.`,
      paymentId,
    };
  }
);
