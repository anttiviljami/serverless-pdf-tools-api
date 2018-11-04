import 'source-map-support/register';
import OpenAPIBackend from 'openapi-backend';
import path from 'path';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

const headers = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-credentials': true,
};

// define api + handlers
const api = new OpenAPIBackend({
  definition: path.join(__dirname, '..', 'openapi.yml'),
  handlers: {
    notImplemented: async (event: APIGatewayProxyEvent, context: Context) => ({
      statusCode: 501,
      body: JSON.stringify({ err: 'not implemented' }),
      headers,
    }),
    notFound: async (event: APIGatewayProxyEvent, context: Context) => ({
      statusCode: 404,
      body: JSON.stringify({ err: 'not found' }),
      headers,
    }),
    validationFail: async (err, event: APIGatewayProxyEvent, context: Context) => ({
      statusCode: 400,
      body: JSON.stringify({ err }),
      headers,
    }),
  },
});

api.init();

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  return api.handleRequest(
    {
      method: event.httpMethod,
      path: event.path,
      query: event.queryStringParameters,
      body: event.body,
      headers: event.headers,
    },
    event,
    context,
  );
}
