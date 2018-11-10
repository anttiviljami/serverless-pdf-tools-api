import { Context } from 'openapi-backend';
import * as Lambda from 'aws-lambda';
import StreamAccumulator from 'stream-accumulator';
import { replyBase64 } from '../util/lambda-util';
import { PDFBuilder, BuilderOutputMode } from '../core/hummus-core';
import { pdfToImageStream, PDFToImageStreamOpts } from '../core/imagemagick-core';
import { PDFPayload } from '../pdf';

export async function composePdfHttpHandler(c: Context, event: Lambda.APIGatewayProxyEvent, context: Lambda.Context) {
  const requestBody = c.request.requestBody as PDFPayload;
  const { recipe, output } = requestBody;

  // return raw buffer as base64
  if (output.type === 'pdf') {
    const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
    await builder.composePDF(recipe);
    return replyBase64(builder.getBuffer(), { headers: { 'Content-Type': 'application/pdf' } });
  }

  if (output.type === 'cover') {
    const builder = new PDFBuilder({ output: BuilderOutputMode.Stream });
    const pdfOpts: PDFToImageStreamOpts = {
      type: 'cover',
      ...output.opts,
    };
    const pdfStream = builder.getReadableStream().pipe(pdfToImageStream(pdfOpts));
    builder.composePDF(recipe);
    const image = await StreamAccumulator.promise(pdfStream);
    return replyBase64(image, { headers: { 'Content-Type': 'image/png' } });
  }

  if (output.type === 'montage') {
    const builder = new PDFBuilder({ output: BuilderOutputMode.Stream });
    const pdfOpts: PDFToImageStreamOpts = {
      type: 'montage',
      ...output.opts,
    };
    const pdfStream = builder.getReadableStream().pipe(pdfToImageStream(pdfOpts));
    builder.composePDF(recipe);
    const image = await StreamAccumulator.promise(pdfStream);
    return replyBase64(image, { headers: { 'Content-Type': 'image/png' } });
  }
}
