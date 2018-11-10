import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import { replyBase64 } from '../util/lambda-util';
import { screenshotHTML, pdfHTML, ScreenshotOptions, PDFOptions } from '../core/puppeteer-core';
import { HTMLPayload } from '../html';

export async function composeHtmlHttpHandler(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  const requestBody = c.request.requestBody as HTMLPayload;
  const { html, output } = requestBody;
  if (output.type === 'screenshot') {
    const image = await screenshotHTML(html, output.opts as ScreenshotOptions);
    return replyBase64(image, { headers: { 'content-type': 'image/png' } });
  }
  if (output.type === 'pdf') {
    const pdf = await pdfHTML(html, output.opts as PDFOptions);
    return replyBase64(pdf, { headers: { 'content-type': 'application/pdf' } });
  }
}
