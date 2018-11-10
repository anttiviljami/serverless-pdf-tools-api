import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import { replyBase64 } from '../util/lambda-util';
import { screenshotFromHTML } from '../core/html-core';

export async function composeHtmlHttpHandler(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  const { requestBody } = c.request;
  const html: string = requestBody.html;
  const image = await screenshotFromHTML(html);
  return replyBase64(image, { headers: { 'content-type': 'image/png' } });
}
