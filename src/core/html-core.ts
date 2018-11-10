import { getBrowser } from '../util/chrome-util';

export async function screenshotFromHTML(html: string) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set HTML as page content and wait for network requests to complete.
  await page.goto(`data:text/html,${html.replace(/#/g, '%23')}`, { waitUntil: 'networkidle0', timeout: 0 });

  // take screenshot
  const file = await page.screenshot({
    omitBackground: true,
  });

  return file;
}
