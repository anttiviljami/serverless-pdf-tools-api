import { ComposePDFRecipe, PDFBuilder, BuilderOutputMode } from './core/pdf-core';

interface HandlerEvent {
  recipe: ComposePDFRecipe;
}

export async function handler(event: HandlerEvent) {
  console.info(event);
  const recipe = event.recipe;
  const builder = new PDFBuilder({ output: BuilderOutputMode.Buffer });
  await builder.composePDF(recipe);
  return builder.getBuffer().toString('base64');
}
