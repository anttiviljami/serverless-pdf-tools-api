import _ from 'lodash';
import BPromise from 'bluebird';
import * as hummus from 'hummus';

import { fetchBuffer } from '../util/fetch-util';
import { HummusReadStream, HummusWriteStream } from '../util/hummus-util';
import { Readable } from 'stream';

export interface ComposePDFRecipe {
  layers: string[];
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

  constructor(opts: PDFBuilderOpts = {}) {
    this.mode = opts.output || BuilderOutputMode.Buffer;
  }

  public async composePDF(recipe: ComposePDFRecipe): Promise<void | Buffer> {
    const timer = `composePdf-${new Date().getTime()}`;
    console.time(timer); // start timer
    const { layers } = recipe;

    // start up a pdf writer to a write stream
    const writeStream = new HummusWriteStream();
    this.outputStream = writeStream.output;
    const writer = hummus.createWriter(writeStream);

    if (this.mode === BuilderOutputMode.Buffer) {
      // capture the output stream data to a buffer
      this.outputData = [];
      const appendData = (chunk: Buffer) => this.outputData.push(chunk);
      this.outputStream.on('data', (chunk) => appendData.bind(this)(chunk));
    }

    // fetch all layers into an array of buffers
    const layerBuffers = await BPromise.mapSeries(layers, async (url: string, index) => {
      console.timeLog(timer, `Fetching layer ${index}: ${url}`);
      const buffer = await fetchBuffer(url);
      console.timeLog(timer, `Fetched layer ${index}! (${buffer.length} bytes)`);
      return buffer;
    });

    // start from bottom layer
    const bottomLayer = new HummusReadStream(_.first(layerBuffers));
    const bottomReader = hummus.createReader(bottomLayer);
    const pagesCount = bottomReader.getPagesCount();

    // compose all pages in sequence
    for (let pagenum = 0; pagenum < pagesCount; pagenum++) {
      console.timeLog(timer, `Composing page ${pagenum}`);

      // get dimensions for the bottom pdf layer
      const pageDimensions = bottomReader.parsePage(pagenum).getMediaBox();

      // create a new page with same dimensions
      const page = writer.createPage(...pageDimensions);
      console.timeLog(timer, `Page ${pagenum} created with dimensions ${pageDimensions.join(', ')}`);

      // create read streams for each pdf layer
      const layerStreams = layerBuffers.map((buffer) => new HummusReadStream(buffer));

      // merge all pdf layers to the page
      for (const [layer, stream] of layerStreams.entries()) {
        console.timeLog(timer, `Merging layer ${layer} to page ${pagenum}...`);
        writer.mergePDFPagesToPage(page, stream, {
          type: hummus.eRangeTypeSpecific,
          specificRanges: [[pagenum, pagenum] as hummus.PageRange],
        });
      }

      // write the page to output
      writer.writePage(page);
    }

    // terminate output
    writer.end();
    writeStream.end();
    console.timeEnd(timer); // finish timer

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
