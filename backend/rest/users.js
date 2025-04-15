const dbData = require('/opt/dbData');
const { prepareCorsHeaders } = require('/opt/corsHeaders');

/**
 * GET /users
 * Returns all users for the tenant
 *
 * Response:
 * {
 *   message: string,
 *   payload: {
 *     users: [{
 *       user_id: string,
 *       user_name: string,
 *       email_address: string,
 *       is_disabled: boolean,
 *       created_at: string
 *     }]
 *   }
 * }
 */
exports.handler = async (event) => {
  const corsHeaders = prepareCorsHeaders(event.headers?.origin);

  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Verify that we have a valid authenticated request
    if (!event.requestContext.authorizer) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Unauthorized request',
        }),
      };
    }

    const users = await dbData.getAllUsers(process.env.SAAS_TENANT_ID);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Users retrieved successfully',
        payload: {
          users,
        },
      }),
    };
  } catch (error) {
    console.error('Error retrieving users:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal server error',
      }),
    };
  }
};
