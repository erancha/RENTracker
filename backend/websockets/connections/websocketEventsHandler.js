const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const AWSXRay = require('aws-xray-sdk');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SESv2Client, GetEmailIdentityCommand, CreateEmailIdentityCommand, SendEmailCommand } = require('@aws-sdk/client-sesv2');

const eventBridgeClient = new EventBridgeClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL.replace(/^wss/, 'https');
const STACK_NAME = process.env.STACK_NAME;
const ENABLE_ENHANCED_LOGGING = process.env.ENABLE_ENHANCED_LOGGING;
const SES_SOURCE_EMAIL = process.env.SES_SOURCE_EMAIL;

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
    const appGatewayClient = new ApiGatewayManagementApiClient({
      apiVersion: '2018-11-29',
      endpoint: WEBSOCKET_API_URL.replace(/^wss/, 'https'),
    });

    const recordsExtractedFromQueue = event.Records;
    await Promise.all(
      recordsExtractedFromQueue.map(async (record) => {
        const extractedRecord = JSON.parse(record.body);
        const MAX_LOG_LENGTH = 1000;
        const extractedRecordLogMessage = `Extracted record: ${record.body.substring(0, MAX_LOG_LENGTH)}${
          record.body.length > MAX_LOG_LENGTH ? ' ...' : ''
        }, record.body length: ${record.body.length} bytes`;
        console.log(extractedRecordLogMessage);

        // Trigger email verification if not already verified
        const pendingEmailVerification = extractedRecord.message?.currentUserEmail
          ? !(await verifyEmailInSES(extractedRecord.message?.currentUserEmail))
          : undefined;

        // Sending to targetConnectionIds Websockets clients:
        if (extractedRecord.targetConnectionIds && extractedRecord.message) {
          const websocketsSubsegment = handlerSubsegment.addNewSubsegment('sendMessageToConnectedClients');
          try {
            // Send the message to all connected websocket clients:
            const jsonMessage = JSON.stringify({ ...extractedRecord.message, pendingEmailVerification });
            const bufferData = Buffer.from(jsonMessage);
            await sendMessageToConnectedClients({
              appGatewayClient,
              targetConnectionIds: extractedRecord.targetConnectionIds,
              bufferData,
              extractedRecordMessage: extractedRecordLogMessage,
            });
          } finally {
            websocketsSubsegment.close();
          }
        }

        // Publishing to EventBridge:
        if (extractedRecord.message) {
          const extractedMessage = extractedRecord.message;
          if (extractedMessage.dataCreated || extractedMessage.dataUpdated || extractedMessage.dataDeleted) {
            const eventBridgeSubsegment = handlerSubsegment.addNewSubsegment('publishToEventBridge');
            await publishToEventBridge({ extractedMessage });
            eventBridgeSubsegment.close();
          }
        }

        // Optionally, email user(s):
        // TODO (v): Refactor to a dedicated SES handler, also in the default lambda space, via a dedicated queue (+ new VPC endpoint...)
        if (extractedRecord.emailParams) {
          const emailSubsegment = handlerSubsegment.addNewSubsegment('sendEmail');
          await sendEmail(extractedRecord.emailParams);
          emailSubsegment.close();
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
// Send bufferData to each connection of targetConnectionIds.
// (extractedRecordMessage is used for logging in case of an error ..)
//=========================================================================================================================================
const sendMessageToConnectedClients = async ({ appGatewayClient, targetConnectionIds, bufferData, extractedRecordMessage }) => {
  for (const connectionId of targetConnectionIds) {
    try {
      await appGatewayClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: bufferData,
        })
      );
    } catch (error) {
      const errorMessage = `connectionId: ${connectionId}, payload size: ${bufferData.length} bytes: ${extractedRecordMessage}`;
      if (error.name === 'GoneException') console.warn(error.name, errorMessage);
      else console.error(error, errorMessage);
    }
  }
};

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
