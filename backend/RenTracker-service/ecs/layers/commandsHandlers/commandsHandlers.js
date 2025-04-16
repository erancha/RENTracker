let CURRENT_TASK_ID = '';

// Environment-aware import for dbData
const dbData = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? require('/opt/dbData') // Lambda environment
  : require('/usr/src/app/layers/dbData/dbData'); // Local/ECS environment

// Middleware for logging parameters
const logMiddleware = (name) => (fn) => {
  const wrappedFunction = async function (...args) {
    if (process.env.ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'true') {
      console.log(`Calling function: ${name} with parameters: ${JSON.stringify(args)}`);
    }
    return await fn(...args);
  };
  wrappedFunction.name = name;
  return wrappedFunction;
};

// Helper function for logging task messages
const logTaskMessage = (type, data) => {
  const formattedData = process.env.ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'true' ? JSON.stringify(data, null, 2) : JSON.stringify(data).substring(0, 600);
  console.log(`Task ${CURRENT_TASK_ID}: ${type} ${formattedData}.`);
};

// Main command handler
const handleCommand = logMiddleware('handleCommand')(async function ({ commandType, commandParams, connectedUserId }) {
  let response;

  logTaskMessage('Request', { commandType, commandParams, connectedUserId });

  switch (commandType) {
    case 'create':
      response = await handleCreate({ commandParams, connectedUserId });
      break;

    case 'read':
      response = await handleRead({ commandParams, connectedUserId });
      break;

    case 'update':
      response = await handleUpdate({ commandParams });
      break;

    case 'delete':
      response = await handleDelete({ commandParams });
      break;

    default:
      throw 'Unknown command type!';
  }

  logTaskMessage('Response', response);

  return response;
});

// Command handler to create a record
async function handleCreate({ commandParams, connectedUserId }) {
  let response; // to the client socket

  if (commandParams.apartments) {
    const { apartment_id, address, unit_number, rooms_count, rent_amount } = commandParams.apartments;
    response = {
      apartments: (
        await dbData.createApartment({
          apartment_id,
          address,
          unit_number,
          rooms_count,
          rent_amount,
          landlord_id: connectedUserId,
          saas_tenant_id: process.env.SAAS_TENANT_ID,
        })
      ).data,
    };
  } else if (commandParams.activity) {
    const { activity_id, description, apartment_id, pending_confirmation } = commandParams.activity;
    response = {
      activity: await dbData.createActivity({ activity_id, apartment_id, description, pending_confirmation, saas_tenant_id: process.env.SAAS_TENANT_ID }),
    };
    await dbData.cache.invalidation.getApartmentActivity(apartment_id);
  }

  if (response) return { dataCreated: response };
}

// Command handler to read records
const handleRead = logMiddleware('handleRead')(async function ({ commandParams, connectedUserId }) {
  let response; // to the client socket

  if (commandParams.apartments) {
    const dbResult = await dbData.getApartmentsOfLandlord({ user_id: connectedUserId, saas_tenant_id: process.env.SAAS_TENANT_ID }); /* handle pagination */
    response = { apartments: dbResult || [] };
  }
  if (commandParams.activity) {
    let apartment_id = commandParams.activity.apartment_id;
    if (!apartment_id && response?.apartments.length > 0 && commandParams.activity.fromFirstApartment) apartment_id = response.apartments[0].apartment_id;
    if (apartment_id)
      response = {
        ...response,
        activity: await dbData.cache.getApartmentActivity({ apartment_id, saas_tenant_id: process.env.SAAS_TENANT_ID }),
      };
  }

  if (response) return { dataRead: { ...response } };
});

// Command handler to update a record
async function handleUpdate({ commandParams }) {
  let response; // to the client socket

  if (commandParams.apartments) {
    const { apartment_id, address, unit_number, rooms_count, rent_amount, is_disabled } = commandParams.apartments;
    response = {
      apartments: await dbData.updateApartment({
        apartment_id,
        address,
        unit_number,
        rooms_count,
        rent_amount,
        is_disabled,
        saas_tenant_id: process.env.SAAS_TENANT_ID,
      }),
    };
  }

  if (response) return { dataUpdated: response };
}

// Command handler to delete a record
async function handleDelete({ commandParams }) {
  let response; // to the client socket

  if (commandParams.apartments) {
    const { apartment_id } = commandParams.apartments;
    response = { apartments: await dbData.deleteApartment({ apartment_id, saas_tenant_id: process.env.SAAS_TENANT_ID }) };
    await dbData.cache.invalidation.getApartmentActivity(apartment_id);
  }

  if (response) return { dataDeleted: response };
}

// Helper function to determine target users based on command type and parameters
function determineTargetUsers({ commandType, commandParams, response, connectedUserId }) {
  try {
    const targetUserIds = [];

    if (commandParams.apartments) {
      switch (commandType) {
        case 'create':
          targetUserIds.push(process.env.ADMIN_USER_ID, connectedUserId);
          break;
        case 'update':
          targetUserIds.push(response.dataUpdated.apartments.user_id);
          break;
        case 'delete':
          targetUserIds.push(response.dataDeleted.apartments.user_id);
          break;
      }
    } else if (commandParams.activity) {
      switch (commandType) {
        case 'create':
          targetUserIds.push(connectedUserId);
          // if (response.dataCreated.activity) { //TODO
          //   targetUserIds.push(response.dataCreated.activity.apartment.user_id);
          // }
          break;
        case 'read':
          targetUserIds.push(connectedUserId);
          break;
        default:
          console.log('Not implemented!');
          break;
      }
    }

    return targetUserIds;
  } catch (error) {
    console.error('Error in determineTargetUsers:');
    console.error('Stack:', error.stack);
    console.error(
      'Parameters:',
      JSON.stringify(
        {
          commandType,
          commandParams,
          response,
          connectedUserId,
        },
        null,
        2
      )
    );
    throw error;
  }
}

module.exports = {
  handleCommand,
  handleRead,
  determineTargetUsers,
  setTaskId: (taskId) => {
    CURRENT_TASK_ID = taskId;
  },
};
