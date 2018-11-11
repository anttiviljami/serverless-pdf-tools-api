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

interface BaseElement {
  type: string;
  page: string | number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  font: string;
  size: number;
  color: string;
  lineHeight?: number;
  align?: TextAlign;
}

type Element = TextElement;

export interface ComposePDFRecipe {
  layers: URLReference[];
  fonts?: FontReference[];
  elements?: Element[];
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

  public getReadableStream() {
    return this.outputStream;
  }

  public getBuffer() {
    return Buffer.concat(this.outputData);
  }

  public async composePDF(recipe: ComposePDFRecipe): Promise<void | Buffer> {
    const { fonts, layers, elements } = recipe;
    const timer = `composePdf-${new Date().getTime()}`;
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

      // draw elements on page
      const pageElements = _.filter(elements || [], (el) => Number(el.page) === pagenum || el.page === 'all');
      perf.timeLog(timer, `Drawing ${pageElements.length} elements on page ${pagenum}...`);
      pageElements.forEach((el) => {
        if (el.type === 'text') {
          return this.drawText(el, writer, ctx);
        }
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

  private drawText(el: TextElement, writer: hummus.HummusWriter, ctx: hummus.ContentContext) {
    const font = writer.getFontForFile(getFilePathForFontFamily(el.font));
    const lineHeight = el.lineHeight || 1;

    // wrap lines
    const lines: string[] = [];
    el.text.split('\n').map((line, linenum) => {
      // calculate line dimensions
      const lineDimensions = font.calculateTextDimensions(line, el.size);
      if (el.width && lineDimensions.width > el.width) {
        // this line is too long, need to word-wrap it
        const words = line.split(' ');

        let lineWords: string[] = [];
        let lineLength = 0;
        for (const word of words) {
          // calculate word dimensions
          const wordDimensions = font.calculateTextDimensions(word, el.size);
          lineLength += wordDimensions.width;
          if (lineLength > el.width) {
            // new line
            if (lineWords.length > 1) {
              // new line from current line
              lines.push(lineWords.join(' '));

              // push wrapping word to next line
              lineWords = [word];
              lineLength = wordDimensions.width;
            } else {
              // this word is longer than the entire line
              // just push it as its own line
              lines.push(word);
              // reset line
              lineLength = 0;
              lineWords = [];
            }
          } else {
            // push word to current line
            lineWords.push(word);
          }
        }
        // push any remaining words to its own line
        lines.push(lineWords.join(' '));
      } else {
        // this line fits
        lines.push(line);
      }
    });

    lines.map((line, linenum) => {
      // convert rotation to radians
      const rad = (-el.rotation * Math.PI) / 180;

      // Calculate line dimensions.
      const lineDimensions = font.calculateTextDimensions(line, el.size);

      // align
      const anchor = {
        left: 0,
        center: lineDimensions.width / 2,
        right: lineDimensions.width,
        _default: 0,
      };

      // calculate position based on rotation and alignment
      const xOrigin = el.x;
      const yOrigin = el.y;

      const verticalOffset = linenum * lineHeight * el.size; // line offset
      const horizontalOffset = _.get(anchor, el.align, anchor._default); // align offset

      const x = xOrigin + Math.sin(rad) * verticalOffset - Math.cos(rad) * horizontalOffset;
      const y = yOrigin - Math.cos(rad) * verticalOffset - Math.sin(rad) * horizontalOffset;

      // draw each line
      ctx.q();
      ctx.cm(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), x, y);
      ctx.writeText(line, 0, 0, {
        font,
        size: el.size,
        color: cmykStringToHex(el.color),
        colorspace: 'cmyk',
      });
      ctx.Q();
    });
  }
}

function getFilePathForFontFamily(family: string) {
  const fontFilePath = path.join(path.sep, 'tmp', `${family}.ttf`);
  return fontFilePath;
}
