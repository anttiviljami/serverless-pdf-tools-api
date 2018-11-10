import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import { replyJSON } from '../util/lambda-util';

export async function composePdf(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  return replyJSON({});
}
