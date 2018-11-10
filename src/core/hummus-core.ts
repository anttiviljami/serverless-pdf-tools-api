import _ from 'lodash';
import BPromise from 'bluebird';
import path from 'path';
import fs from 'fs';

import * as hummus from 'hummus';

import { fetchBuffer } from '../util/fetch-util';
import { HummusReadStream, HummusWriteStream } from '../util/hummus-util';
import { cmykStringToHex } from '../util/cmyk-util';
import * as perf from '../util/perf';

import { Readable } from 'stream';

interface URLReference {
  url: string;
}

interface FontReference extends URLReference {
  family: string;
}

enum TextAlign {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

interface Field {
  page: string | number;
  x: number;
  y: number;
  text: string;
  font: string;
  size: number;
  color: string;
  lineHeight?: number;
  align?: TextAlign;
  rotation?: number;
}

export interface ComposePDFRecipe {
  layers: URLReference[];
  fonts?: FontReference[];
  fields?: Field[];
}

export enum BuilderOutputMode {
  Stream = 'stream',
  Buffer = 'buffer',
}

export interface PDFBuilderOpts {
  output?: BuilderOutputMode;
}

export class PDFBuilder {
  public mode: BuilderOutputMode;
  public outputStream: Readable;
  public outputData: Buffer[];

  private writeStream: HummusWriteStream;

  constructor(opts: PDFBuilderOpts = {}) {
    this.mode = opts.output || BuilderOutputMode.Buffer;

    // initalize a write stream for hummus
    this.writeStream = new HummusWriteStream();
    this.outputStream = this.writeStream.output;
  }

  public async composePDF(recipe: ComposePDFRecipe): Promise<void | Buffer> {
    const timer = `composePdf-${new Date().getTime()}`;
    const { fonts, layers, fields } = recipe;
    perf.time(timer, `Started composing pdf from recipe and ${layers.length} layers`); // start timer

    // start up a pdf writer to a write stream
    const writer = hummus.createWriter(this.writeStream);

    if (this.mode === BuilderOutputMode.Buffer) {
      // capture the output stream data to a buffer
      this.outputData = [];
      const appendData = (chunk: Buffer) => this.outputData.push(chunk);
      this.outputStream.on('data', (chunk) => appendData.bind(this)(chunk));
    }

    if (fonts) {
      // fetch and initalize all fonts
      await BPromise.map(fonts, async (font) => {
        perf.timeLog(timer, `Checking font cache for ${font.family}`);
        const fontFilePath = getFilePathForFontFamily(font.family);
        if (!fs.existsSync(fontFilePath)) {
          perf.timeLog(timer, `Fetching font ${font.family} from ${font.url}...`);
          const buffer = await fetchBuffer(font.url);
          fs.writeFileSync(fontFilePath, buffer);
          perf.timeLog(timer, `Initalized font ${font.family}`);
        }
      });
    }

    // fetch all layers into an array of buffers
    const layerBuffers = await BPromise.mapSeries(layers, async (layer, index) => {
      perf.timeLog(timer, `Fetching layer ${index}: ${layer.url}`);
      const buffer = await fetchBuffer(layer.url);
      perf.timeLog(timer, `Fetched layer ${index}! (${buffer.length} bytes)`);
      return buffer;
    });

    // start from bottom layer
    const bottomLayer = new HummusReadStream(_.first(layerBuffers));
    const bottomReader = hummus.createReader(bottomLayer);
    const pagesCount = bottomReader.getPagesCount();

    // compose all pages in sequence
    for (let pagenum = 0; pagenum < pagesCount; pagenum++) {
      perf.timeLog(timer, `Composing page ${pagenum}`);

      // get dimensions for the bottom pdf layer
      const pageDimensions = bottomReader.parsePage(pagenum).getMediaBox();

      // create a new page with same dimensions
      const page = writer.createPage(...pageDimensions);
      perf.timeLog(timer, `Page ${pagenum} created with dimensions ${pageDimensions.join(', ')}`);

      // create read streams for each pdf layer
      const layerStreams = layerBuffers.map((buffer) => new HummusReadStream(buffer));

      // merge all pdf layers to the page
      for (const [layer, stream] of layerStreams.entries()) {
        perf.timeLog(timer, `Merging layer ${layer} to page ${pagenum}...`);
        writer.mergePDFPagesToPage(page, stream, {
          type: hummus.eRangeTypeSpecific,
          specificRanges: [[pagenum, pagenum] as hummus.PageRange],
        });
      }

      // create a content context for page
      const ctx = writer.startPageContentContext(page);

      // write fields for page
      const pageFields = _.filter(fields || [], (field) => Number(field.page) === pagenum || field.page === 'all');
      perf.timeLog(timer, `Writing ${pageFields.length} text fields on page ${pagenum}...`);
      pageFields.forEach((field) => {
        // rotation
        const rad = 0;

        // draw text
        ctx.q();
        ctx.cm(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), field.x, field.y);
        ctx.writeText(field.text, 0, 0, {
          font: writer.getFontForFile(getFilePathForFontFamily(field.font)),
          size: field.size,
          color: cmykStringToHex(field.color),
          colorspace: 'cmyk',
        });
        ctx.Q();
      });

      // write the page to output
      writer.writePage(page);
      perf.timeLog(timer, `Page ${pagenum} finished!`);
    }

    // terminate output
    writer.end();
    this.writeStream.end();
    perf.timeEnd(timer, `Finished writing pdf`); // finish timer

    // return a buffer from this function if output type is specified as buffer
    if (this.mode === BuilderOutputMode.Buffer) {
      return this.getBuffer();
    }
  }

  public getReadableStream() {
    return this.outputStream;
  }

  public getBuffer() {
    return Buffer.concat(this.outputData);
  }
}

function getFilePathForFontFamily(family: string) {
  const fontFilePath = path.join(path.sep, 'tmp', `${family}.ttf`);
  return fontFilePath;
}
