import { screenshotFromHTML } from './core/html-core';

interface HandlerEvent {
  html: string;
}

export async function handler(event: HandlerEvent) {
  console.info(event);
  const html = event.html;
  const image = await screenshotFromHTML(html);
  return image.toString('base64');
}
