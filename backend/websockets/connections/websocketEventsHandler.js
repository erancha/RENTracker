const { ApiGatewayManagementApiClient } = require('@aws-sdk/client-apigatewaymanagementapi');
const { sendMessageToConnectedClients } = require('/opt/connections');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const AWSXRay = require('aws-xray-sdk');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SESv2Client, GetEmailIdentityCommand, CreateEmailIdentityCommand, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const eventBridgeClient = new EventBridgeClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL.replace(/^wss/, 'https');
const STACK_NAME = process.env.STACK_NAME;
const ENABLE_ENHANCED_LOGGING = process.env.ENABLE_ENHANCED_LOGGING;
const SES_SOURCE_EMAIL = process.env.SES_SOURCE_EMAIL;
const DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID = process.env.DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID;

//=========================================================================================================================================
// Handler:
//   1. Extracts messages from an SQS queue.
//   2. Sends each extracted message to WebSocket clients, on connection ids extracted from the message.
//=========================================================================================================================================
exports.handler = async (event) => {
  const segment = AWSXRay.getSegment();
  segment.addAnnotation('stackName', STACK_NAME);
  const handlerSubsegment = segment.addNewSubsegment('websocketEventsHandler');

  try {
    const appGatewayClient = new ApiGatewayManagementApiClient({ apiVersion: '2018-11-29', endpoint: WEBSOCKET_API_URL });

    const recordsExtractedFromQueue = event.Records;
    await Promise.all(
      recordsExtractedFromQueue.map(async (record) => {
        const extractedParsedRecord = JSON.parse(record.body);

        // Trigger email verification if not already verified
        const pendingEmailVerification = extractedParsedRecord.message?.currentUserEmail
          ? !(await verifyEmailInSES(extractedParsedRecord.message?.currentUserEmail))
          : undefined;

        // Sending to targetConnectionIds Websockets clients:
        if (extractedParsedRecord.targetConnectionIds && extractedParsedRecord.message) {
          const websocketsSubsegment = handlerSubsegment.addNewSubsegment('sendMessageToConnectedClients');
          try {
            await sendMessageToConnectedClients({
              targetConnectionIds: extractedParsedRecord.targetConnectionIds,
              message: JSON.stringify({ ...extractedParsedRecord.message, pendingEmailVerification }),
              appGatewayClient,
            });
          } finally {
            websocketsSubsegment.close();
          }
        }

        // Optionally, email user(s):
        // TODO (v): Refactor to a dedicated SES handler, also in the default lambda space, via a dedicated queue (+ new VPC endpoint...)
        if (extractedParsedRecord.emailParams) {
          const emailSubsegment = handlerSubsegment.addNewSubsegment('sendEmail');
          await sendEmail(extractedParsedRecord.emailParams);
          emailSubsegment.close();
        }

        // Publishing to EventBridge:
        if (extractedParsedRecord.message) {
          const extractedMessage = extractedParsedRecord.message;
          if (extractedMessage.dataCreated || extractedMessage.dataUpdated || extractedMessage.dataDeleted) {
            const eventBridgeSubsegment = handlerSubsegment.addNewSubsegment('publishToEventBridge');
            await publishToEventBridge({ extractedMessage });
            eventBridgeSubsegment.close();
          }
        }

        // Optionally, invalidate an S3 key:
        if (extractedParsedRecord.cloudfrontInvalidationParams) {
          await handleInvalidate(extractedParsedRecord.cloudfrontInvalidationParams.s3Key);
        }
      })
    );
  } catch (error) {
    console.error(`Error: ${error}, event: ${JSON.stringify(event, null, 2)}`);
  } finally {
    handlerSubsegment.close();
  }
};

//=============================================================================================================================================
// Utilities
//=============================================================================================================================================

//=========================================================================================================================================
// Helper function to publish events to EventBridge
//=========================================================================================================================================
const publishToEventBridge = async ({ extractedMessage }) => {
  try {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: 'RENTracker-service',
          DetailType: 'command-executed',
          Detail: JSON.stringify(extractedMessage),
          EventBusName: `${STACK_NAME}-commands-event-bus`,
          Time: new Date(),
        },
      ],
    });
    const result = await eventBridgeClient.send(command);

    if (ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'false') {
      console.log(`Event ${JSON.stringify(extractedMessage)} published successfully: ${JSON.stringify(result)}`);
    }

    return result;
  } catch (error) {
    console.error('Error publishing event to EventBridge:', error);
  }
};

// Helper function to initiate email verification in SES
// This function sends a verification email to the provided address if it's not already verified
// The user will need to click the link in the verification email to complete the process
async function verifyEmailInSES(email) {
  const sesClient = captureAWSv3Client(new SESv2Client({ region: AWS_REGION }));
  try {
    // Try to create the identity first
    const verifyCommand = new CreateEmailIdentityCommand({ EmailIdentity: email });
    await sesClient.send(verifyCommand);
    console.log(`Verification email sent to ${email}`);
    return false;
  } catch (error) {
    if (error.name === 'AlreadyExistsException') {
      // If identity exists, check if it's verified
      try {
        const checkCommand = new GetEmailIdentityCommand({ EmailIdentity: email });
        const checkResponse = await sesClient.send(checkCommand);
        return checkResponse.VerifiedForSendingStatus === true;
      } catch (checkError) {
        console.error('Error checking email verification status:', checkError);
        return false;
      }
    }
    console.error('Error in email verification process:', error);
    return false;
  }
}

//=========================================================================================================================================
// Email:  // TODO: Refactor to a dedicated SES handler, also in the default lambda space, via a dedicated queue (+ new VPC endpoint...)
//=========================================================================================================================================
const sendEmail = async ({ fromAddress, toAddresses, subject, message }) => {
  const sesClient = captureAWSv3Client(new SESv2Client({ region: AWS_REGION }));
  const params = {
    FromEmailAddress: /*fromAddress ||*/ SES_SOURCE_EMAIL,
    Destination: {
      ToAddresses: Array.isArray(toAddresses) ? toAddresses : [toAddresses],
    },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: message } },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log(`Email sent successfully to ${toAddresses}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Invalidate the CloudFront cache for an S3 key.
 * @param {string} s3Key - the key to invalidate.
 * @returns {Promise<void>}
 */
async function handleInvalidate(s3Key) {
  try {
    const cloudfront = new CloudFrontClient();

    await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: `${Date.now()}`,
          Paths: { Quantity: 1, Items: [`/${s3Key}`] },
        },
      })
    );
    console.log(`CloudFront cache invalidated for: ${s3Key}`);
  } catch (error) {
    console.error('Error invalidating CloudFront cache:', error);
  }
}
