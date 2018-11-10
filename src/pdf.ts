import { ComposePDFRecipe, PDFBuilder, BuilderOutputMode } from './core/hummus-core';
import { pdfToImageStream, PDFToImageStreamOpts } from './core/imagemagick-core';
import StreamAccumulator from 'stream-accumulator';

export interface PDFPayload {
  recipe: ComposePDFRecipe;
  output: {
    type: 'pdf' | 'cover' | 'montage';
    opts?: PDFToImageStreamOpts;
  };
}

export async function handler(event: PDFPayload) {
  console.info(event);
  const { recipe, output } = event;
  if (output.type === 'pdf') {
    const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
    await builder.composePDF(recipe);
    return builder.getBuffer().toString('base64');
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
    return image.toString('base64');
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
    return image.toString('base64');
  }
}
