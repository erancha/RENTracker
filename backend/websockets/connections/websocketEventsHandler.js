const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const eventBridgeClient = new EventBridgeClient();

const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL.replace(/^wss/, 'https');

//=========================================================================================================================================
// Handler:
//   1. Extracts messages from an SQS queue.
//   2. Sends each extracted message to WebSocket clients, on connection ids extracted from the message.
//=========================================================================================================================================
exports.handler = async (event) => {
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
        const extractedRecordMessage = `Extracted record: ${record.body.substring(0, MAX_LOG_LENGTH)}${
          record.body.length > MAX_LOG_LENGTH ? ' ...' : ''
        }, record.body length: ${record.body.length} bytes`;
        console.log(extractedRecordMessage);

        if (extractedRecord.targetConnectionIds) {
          const targetConnectionIds = extractedRecord.targetConnectionIds;

          if (extractedRecord.message) {
            // Send the message to all connected websocket clients:
            const jsonMessage = JSON.stringify(extractedRecord.message);

            await publishToEventBridge({ ...extractedRecord.message });

            const bufferData = Buffer.from(jsonMessage);
            await sendMessageToConnectedClients({ appGatewayClient, targetConnectionIds, bufferData, extractedRecordMessage });
          }
        }
      })
    );
  } catch (error) {
    console.error(`Error: ${error}, event: ${JSON.stringify(event, null, 2)}`);
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
const publishToEventBridge = async (eventDetail) => {
  try {
    const params = {
      Entries: [
        {
          Source: 'RenTracker-service',
          DetailType: 'command-executed',
          Detail: JSON.stringify(eventDetail),
          EventBusName: `${process.env.STACK_NAME}-commands-event-bus`,
          Time: new Date(),
        },
      ],
    };

    const command = new PutEventsCommand(params);
    const result = await eventBridgeClient.send(command);

    if (process.env.ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'true') {
      console.log(`Event ${JSON.stringify(eventDetail)} published successfully: ${JSON.stringify(result)}`);
    }

    return result;
  } catch (error) {
    console.error('Error publishing event to EventBridge:', error);
    throw error;
  }
};
