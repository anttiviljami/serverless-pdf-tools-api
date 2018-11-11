import _ from 'lodash';
import BPromise from 'bluebird';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';

import * as hummus from 'hummus';
import fetch from 'node-fetch';
import mime from 'mime';

import { fetchBuffer } from '../util/fetch-util';
import { HummusReadStream, HummusWriteStream } from '../util/hummus-util';
import { cmykStringToHex } from '../util/cmyk-util';
import * as perf from '../util/perf';

import { Readable } from 'stream';
import { pdfHTML } from './puppeteer-core';

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

interface ImageElement extends BaseElement {
  type: 'image';
  url: string;
}

interface HTMLElement extends BaseElement {
  type: 'html';
  html: string;
  pageWidth: string;
  pageHeight: string;
}

type Element = TextElement | ImageElement | HTMLElement;

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
  private layerBuffers: Buffer[];
  private imageFiles: { [url: string]: string };

  constructor(opts: PDFBuilderOpts = {}) {
    this.mode = opts.output || BuilderOutputMode.Buffer;

    // initalize a write stream for hummus
    this.writeStream = new HummusWriteStream();
    this.outputStream = this.writeStream.output;
  }

  /**
   * Gets the composed pdf file as readable stream
   *
   * @returns
   * @memberof PDFBuilder
   */
  public getReadableStream() {
    return this.outputStream;
  }

  /**
   * Gets the composed pdf file as Buffer
   *
   * @returns
   * @memberof PDFBuilder
   */
  public getBuffer() {
    return Buffer.concat(this.outputData);
  }

  /**
   * Composes the PDF file from recipe (populates either readable stream or buffer)
   *
   * @param {ComposePDFRecipe} recipe
   * @returns {(Promise<void | Buffer>)}
   * @memberof PDFBuilder
   */
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
        const fontFilePath = this.getFilePathForFontFamily(font.family);
        if (!fs.existsSync(fontFilePath)) {
          perf.timeLog(timer, `Fetching font ${font.family} from ${font.url}...`);
          const buffer = await fetchBuffer(font.url);
          fs.writeFileSync(fontFilePath, buffer);
          perf.timeLog(timer, `Initalized font ${font.family}`);
        }
      });
    }

    // fetch all layers into an array of buffers
    this.layerBuffers = await BPromise.mapSeries(layers, async (layer, index) => {
      perf.timeLog(timer, `Fetching layer ${index}: ${layer.url}`);
      const buffer = await fetchBuffer(layer.url);
      perf.timeLog(timer, `Fetched layer ${index}! (${buffer.length} bytes)`);
      return buffer;
    });

    // get all image urls
    const imageUrls = _.chain(elements)
      .filter({ type: 'image' })
      .map('url')
      .uniq()
      .value();

    // fetch all images to disk
    // (can't use buffers here because hummus can't get dimensions for images created from streams)
    const imageFiles = await BPromise.mapSeries(imageUrls, async (url) => {
      perf.timeLog(timer, `Fetching image ${url}`);
      const res = await fetch(url);
      const buffer = await res.buffer();
      const ext = mime.getExtension(res.headers.get('Content-Type'));
      const targetFile = this.getFilePathForImageURL(url, ext);
      fs.writeFileSync(targetFile, buffer);
      perf.timeLog(timer, `Saved image to ${targetFile} (${buffer.length} bytes)`);
      return targetFile;
    });

    // create a dictionary of image urls to buffers
    this.imageFiles = _.zipObject(imageUrls, imageFiles);

    // get all html fragments
    const htmlElements = _.filter(elements, { type: 'html' });

    // generate pdf fragments from html elements using puppeteer and save to disk
    await BPromise.mapSeries(htmlElements, async (el, index) => {
      perf.timeLog(timer, `Generating pdf fragment for html ${index}...`);
      const { html, pageWidth, pageHeight } = el as HTMLElement;
      const targetFile = this.getPDFFragmentFilePathForHtmlElement(el as HTMLElement);
      const buffer = await pdfHTML(html, {
        emulateMedia: 'screen',
        width: pageWidth,
        height: pageHeight,
        pageRanges: '1',
        omitBackground: true, // set background to transparent
        printBackground: true, // include the transparent background
      });
      fs.writeFileSync(targetFile, buffer);
      perf.timeLog(timer, `Saved pdf fragment to ${targetFile} (${buffer.length} bytes)`);
    });

    // start from bottom layer
    const bottomLayer = new HummusReadStream(_.first(this.layerBuffers));
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
      const layerStreams = this.layerBuffers.map((buffer) => new HummusReadStream(buffer));

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
          return this.drawText(el as TextElement, writer, ctx);
        }

        if (el.type === 'image') {
          return this.drawImage(el as ImageElement, writer, ctx);
        }

        if (el.type === 'html') {
          return this.drawHtml(el as HTMLElement, writer, ctx, page);
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

  /**
   * Draws an HTML fragment (rendered as PDF) onto a page content context
   *
   * @private
   * @param {HTMLElement} el
   * @param {hummus.HummusWriter} writer
   * @param {hummus.ContentContext} ctx
   * @param {hummus.ParsedPage} page
   * @returns {void}
   * @memberof PDFBuilder
   */
  private drawHtml(
    el: HTMLElement,
    writer: hummus.HummusWriter,
    ctx: hummus.ContentContext,
    page: hummus.PDFPage,
  ): void {
    const pdfFragmentPath = this.getPDFFragmentFilePathForHtmlElement(el);
    const fragmentReader = hummus.createReader(pdfFragmentPath);

    // convert rotation to radians
    const rotation = el.rotation || 0;
    const rad = (-rotation * Math.PI) / 180;

    // calculate scale from fragment dimensions and desired element width / height
    const [, , width, height] = fragmentReader.parsePage(0).getMediaBox();
    let scale = 1;
    const limits: number[] = [];
    if (el.width) {
      limits.push(el.width / width); // width ratio
    }
    if (el.height) {
      limits.push(el.height / height); // height ratio
    }
    if (limits.length > 0) {
      // choose the smallest limiting factor
      scale = Math.min(...limits);
    }

    // extract FormX objects from pdf
    const [formId] = writer.createFormXObjectsFromPDF(pdfFragmentPath, hummus.ePDFPageBoxMediaBox);

    // draw pdf
    ctx.q();
    // rotate and translate
    ctx.cm(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), el.x, el.y);
    // scale
    ctx.cm(scale, 0, 0, scale, 0, 0);
    ctx.doXObject(page.getResourcesDictionary().addFormXObjectMapping(formId));
    ctx.Q();
  }

  /**
   * Draws an image onto a page content context
   *
   * @private
   * @param {ImageElement} el
   * @param {hummus.HummusWriter} writer
   * @param {hummus.ContentContext} ctx
   * @memberof PDFBuilder
   */
  private drawImage(el: ImageElement, writer: hummus.HummusWriter, ctx: hummus.ContentContext): void {
    // convert rotation to radians
    const rotation = el.rotation || 0;
    const rad = (-rotation * Math.PI) / 180;

    // create image XObject from buffer
    const image = this.imageFiles[el.url];
    const imageType = mime.getType(image);

    let XObject: hummus.XObject;
    if (imageType === 'image/png') {
      XObject = writer.createFormXObjectFromPNG(image);
    }
    if (imageType === 'image/jpeg') {
      XObject = writer.createFormXObjectFromJPG(image);
    }

    // calculate scale from image dimensions and desired element width / height
    let scale = 1;
    const { width, height } = writer.getImageDimensions(image);
    const limits: number[] = [];
    if (el.width) {
      limits.push(el.width / width); // width ratio
    }
    if (el.height) {
      limits.push(el.height / height); // height ratio
    }
    if (limits.length > 0) {
      // choose the smallest limiting factor
      scale = Math.min(...limits);
    }

    // draw image
    ctx.q();
    // rotate and translate
    ctx.cm(Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), el.x, el.y);
    // scale
    ctx.cm(scale, 0, 0, scale, 0, 0);
    ctx.doXObject(XObject);
    ctx.Q();
  }

  /**
   * Draws a text element onto a page content context
   *
   * @private
   * @param {TextElement} el
   * @param {hummus.HummusWriter} writer
   * @param {hummus.ContentContext} ctx
   * @memberof PDFBuilder
   */
  private drawText(el: TextElement, writer: hummus.HummusWriter, ctx: hummus.ContentContext): void {
    const font = writer.getFontForFile(this.getFilePathForFontFamily(el.font));
    const lineHeight = el.lineHeight || 1;

    // convert rotation to radians
    const rotation = el.rotation || 0;
    const rad = (-rotation * Math.PI) / 180;

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

  private getFilePathForFontFamily(family: string) {
    const filePath = path.join(path.sep, 'tmp', `font-${family}.ttf`);
    return filePath;
  }

  private getFilePathForImageURL(url: string, extension: string) {
    const hash = createHash('sha256')
      .update(url)
      .digest('hex');
    const filePath = path.join(path.sep, 'tmp', `image-${hash}.${extension}`);
    return filePath;
  }

  private getPDFFragmentFilePathForHtmlElement(el: HTMLElement) {
    const hash = createHash('sha256')
      .update(JSON.stringify(el))
      .digest('hex');
    const filePath = path.join(path.sep, 'tmp', `fragment-${hash}.pdf`);
    return filePath;
  }
}
