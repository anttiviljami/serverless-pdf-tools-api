import { ComposePDFRecipe, PDFBuilder, BuilderOutputMode } from './core/hummus-core';

export interface PDFPayload {
  recipe: ComposePDFRecipe;
  output: {
    type: 'pdf';
  };
}

export async function handler(event: PDFPayload) {
  console.info(event);
  const recipe = event.recipe;
  const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
  await builder.composePDF(recipe);
  return builder.getBuffer().toString('base64');
}
