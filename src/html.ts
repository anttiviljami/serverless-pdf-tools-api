import { screenshotHTML, pdfHTML, ScreenshotOptions, PDFOptions } from './core/puppeteer-core';

export interface HTMLPayload {
  html: string;
  output: {
    type: 'screenshot' | 'pdf';
    opts?: ScreenshotOptions | PDFOptions;
  };
}

export async function handler(event: HTMLPayload) {
  console.info(event);
  const { html, output } = event;
  if (output.type === 'screenshot') {
    const image = await screenshotHTML(html, output.opts as ScreenshotOptions);
    return image.toString('base64');
  }
  if (output.type === 'pdf') {
    const pdf = await pdfHTML(html, output.opts as PDFOptions);
    return pdf.toString('base64');
  }
}
