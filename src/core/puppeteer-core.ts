import { getBrowser } from '../util/chrome-util';
import * as perf from '../util/perf';

export interface ScreenshotOptions {
  path?: string;
  type?: 'jpeg' | 'png';
  quality?: number;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  viewport?: {
    width: number;
    height: number;
  };
  omitBackground?: boolean;
}

export async function screenshotHTML(html: string, opts?: ScreenshotOptions) {
  const timer = `screenshotHTML-${new Date().getTime()}`;
  perf.time(timer); // start timer

  perf.timeLog(timer, `Getting chromium instance...`);
  const browser = await getBrowser();

  // open page
  perf.timeLog(timer, `Opening new browser tab...`);
  const page = await browser.newPage();

  // set viewport
  page.setViewport({ ...page.viewport(), ...(opts.viewport || {}) });

  // Set HTML as page content and wait for network requests to complete.
  perf.timeLog(timer, `Populating page source with HTML and rendering`);
  await page.goto(`data:text/html,${html.replace(/#/g, '%23')}`, { waitUntil: 'networkidle0', timeout: 0 });

  // take screenshot
  perf.timeLog(timer, `Taking screenshot of rendered page`);
  const image = await page.screenshot(opts);

  browser.close();
  perf.timeEnd(timer, `Finished screenshot`);
  return image;
}

export type PDFFormat = 'Letter' | 'Legal' | 'Tabload' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5';

export interface PDFOptions {
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  landscape?: boolean;
  pageRanges?: string;
  format?: PDFFormat;
  width?: string;
  height?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  preferCSSPageSize?: boolean;
  emulateMedia: 'screen' | 'print';
  omitBackground: true;
}

export async function pdfHTML(html: string, opts?: PDFOptions) {
  const timer = `pdfHTML-${new Date().getTime()}`;
  perf.time(timer); // start timer

  perf.timeLog(timer, `Getting chromium instance...`);
  const browser = await getBrowser();

  perf.timeLog(timer, `Opening new browser tab...`);
  const page = await browser.newPage();

  // Set HTML as page content and wait for network requests to complete.
  perf.timeLog(timer, `Populating page source with HTML and rendering`);
  await page.goto(`data:text/html,${html.replace(/#/g, '%23')}`, { waitUntil: 'networkidle0', timeout: 0 });

  // generate pdf from page
  perf.timeLog(timer, `Generating pdf of rendered page`);

  if (opts && opts.emulateMedia) {
    page.emulateMedia(opts.emulateMedia);
  }

  if (opts && opts.omitBackground) {
    // @ts-ignore: Property '_emulationManager' does not exist on type 'Page'.
    await page._emulationManager._client.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
  }

  const pdf = await page.pdf(opts);

  browser.close();
  perf.timeEnd(timer, `Finished pdf`);
  return pdf;
}
