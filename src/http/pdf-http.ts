import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import { replyJSON, replyBase64 } from '../util/lambda-util';
import { ComposePDFRecipe, PDFBuilder, BuilderOutputMode } from '../core/pdf-core';

export async function composePdfHttpHandler(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  const { headers, requestBody } = c.request;
  const recipe: ComposePDFRecipe = requestBody;

  if (headers['accept'] === 'application/pdf') {
    // return raw buffer as base64
    const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
    await builder.composePDF(recipe);
    return replyBase64(builder.getBuffer(), { headers: { 'content-type': 'application/pdf' } });
  } else {
    // @TODO: stream file to S3 and reply with a reference to the object
    const builder = new PDFBuilder({ output: BuilderOutputMode.Stream });
    //    const pdfStream = builder.getReadableStream();
    await builder.composePDF(recipe);
    return replyJSON({});
  }
}
