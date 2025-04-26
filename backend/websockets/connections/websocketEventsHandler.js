const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const AWSXRay = require('aws-xray-sdk');
const eventBridgeClient = new EventBridgeClient();

const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL.replace(/^wss/, 'https');
const STACK_NAME = process.env.STACK_NAME;
const ENABLE_ENHANCED_LOGGING = process.env.ENABLE_ENHANCED_LOGGING;

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

        // Sending to connected Websockets clients:
        if (extractedRecord.targetConnectionIds && extractedRecord.message) {
          const sendMessageSubsegment = handlerSubsegment.addNewSubsegment('sendMessageToConnectedClients');
          try {
            // Send the message to all connected websocket clients:
            const jsonMessage = JSON.stringify(extractedRecord.message);
            const bufferData = Buffer.from(jsonMessage);
            await sendMessageToConnectedClients({
              appGatewayClient,
              targetConnectionIds: extractedRecord.targetConnectionIds,
              bufferData,
              extractedRecordMessage: extractedRecordLogMessage,
            });
          } finally {
            sendMessageSubsegment.close();
          }
        }

        // Publishing to EventBridge:
        if (extractedRecord.message) {
          const extractedMessage = extractedRecord.message;
          if (extractedMessage.dataCreated || extractedMessage.dataUpdated || extractedMessage.dataDeleted) {
            const sendMessageSubsegment = handlerSubsegment.addNewSubsegment('publishToEventBridge');
            await publishToEventBridge({ extractedMessage });
            sendMessageSubsegment.close();
          }
        }
      })
    );
  } catch (error) {
    console.error(`Error: ${error}, event: ${JSON.stringify(event, null, 2)}`);
  } finally {
    handlerSubsegment.close();
  }
};

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
