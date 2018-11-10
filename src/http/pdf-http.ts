import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import { replyBase64 } from '../util/lambda-util';
import { PDFBuilder, BuilderOutputMode } from '../core/hummus-core';
import { PDFPayload } from '../pdf';

export async function composePdfHttpHandler(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  const requestBody = c.request.requestBody as PDFPayload;
  const { recipe } = requestBody;

  // return raw buffer as base64
  const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
  await builder.composePDF(recipe);
  return replyBase64(builder.getBuffer(), { headers: { 'Content-Type': 'application/pdf' } });
}
