import { ComposePDFRecipe, PDFBuilder, BuilderOutputMode } from './core/pdf-core';

export async function handler(event: ComposePDFRecipe) {
  const recipe: ComposePDFRecipe = event;
  const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
  await builder.composePDF(recipe);
  return builder.getBuffer().toString('base64');
}
