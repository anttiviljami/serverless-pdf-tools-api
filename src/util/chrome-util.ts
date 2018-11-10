import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import tar from 'tar';

const localChromePath = path.join(__dirname, '..', '..', 'bin', 'headless_shell.tar.gz');
const setupChromePath = path.join(path.sep, 'tmp');
const localExecutablePath = path.join(setupChromePath, 'headless_shell');

const launchOpts = {
  headless: true,
  args: ['--disable-web-security', '--no-sandbox', '--disable-gpu', '--single-process'],
};

// global browser instance between invocations
let browser: Browser;

export async function getBrowser() {
  if (browser && (await isBrowserAvailable())) {
    return browser;
  }
  if (fs.existsSync(puppeteer.executablePath())) {
    // use puppeteer bundled version if available
    browser = await puppeteer.launch(launchOpts);
  } else {
    // set up our own local chrome if needed
    await setupLocalChrome();
    browser = await puppeteer.launch({
      ...launchOpts,
      executablePath: localExecutablePath,
    });
  }
  return browser;
}

export async function setupLocalChrome() {
  if (fs.existsSync(localExecutablePath)) {
    return true;
  }
  return new Promise((resolve, reject) => {
    fs.createReadStream(localChromePath)
      .on('error', (err) => reject(err))
      .pipe(
        tar.x({
          C: setupChromePath,
        }),
      )
      .on('error', (err) => reject(err))
      .on('end', () => resolve());
  });
}

async function isBrowserAvailable() {
  try {
    await browser.version();
    return true;
  } catch (err) {
    return false;
  }
}
