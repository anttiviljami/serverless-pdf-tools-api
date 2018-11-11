import 'source-map-support/register';
import OpenAPIBackend from 'openapi-backend';
import path from 'path';
import * as Lambda from 'aws-lambda';
import { replyJSON } from './util/lambda-util';
import { composePdfHttpHandler } from './http/pdf-http';
import { composeHtmlHttpHandler } from './http/html-http';
import * as perf from './util/perf';

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
  const timer = `request-${new Date().getTime()}`;
  perf.time(timer, `Began handling request ${event.httpMethod} ${event.path}`); // start timer
  try {
    const res = await api.handleRequest(
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
    perf.timeEnd(timer, `Finished handling request ${event.httpMethod} ${event.path}`); // start timer
    return res;
  } catch (err) {
    console.error(err);
    perf.timeEnd(timer, `Finished handling request ${event.httpMethod} ${event.path}`); // start timer
    return replyJSON({ err: 'Unknown error' }, { statusCode: 500 });
  }
}
