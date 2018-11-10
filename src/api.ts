import 'source-map-support/register';
import OpenAPIBackend from 'openapi-backend';
import path from 'path';
import * as Lambda from 'aws-lambda';
import { replyJSON } from './util/lambda-util';
import { composePdfHttpHandler } from './http/pdf-http';
import { composeHtmlHttpHandler } from './http/html-http';

// define api + handlers
const api = new OpenAPIBackend({
  definition: path.join(__dirname, '..', 'openapi.yml'),
});

api.register({
  composePDF: composePdfHttpHandler,
  composeHTML: composeHtmlHttpHandler,
  notFound: async (c, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) => replyJSON({ err: 'not found' }),
  notImplemented: async (c, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) =>
    replyJSON(api.mockResponseForOperation(c.operation.operationId)),
  validationFail: async (c, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) =>
    replyJSON({ err: c.validation.errors }),
});

api.init();

export async function handler(event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  console.info(event);
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
