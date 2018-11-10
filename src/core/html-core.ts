import { getBrowser } from '../util/chrome-util';
import * as perf from '../util/perf';

export async function screenshotHTML(html: string) {
  const timer = `screenshotHTML-${new Date().getTime()}`;
  perf.time(timer); // start timer

  perf.timeLog(timer, `Getting chromium instance...`);
  const browser = await getBrowser();

  perf.timeLog(timer, `Opening new browser tab...`);
  const page = await browser.newPage();

  // Set HTML as page content and wait for network requests to complete.
  perf.timeLog(timer, `Populating page source with HTML and rendering`);
  await page.goto(`data:text/html,${html.replace(/#/g, '%23')}`, { waitUntil: 'networkidle0', timeout: 0 });

  // take screenshot
  perf.timeLog(timer, `Taking screenshot of rendered page`);
  const file = await page.screenshot({
    omitBackground: true,
  });

  perf.timeEnd(timer, `Finished screenshot`);
  return file;
}
