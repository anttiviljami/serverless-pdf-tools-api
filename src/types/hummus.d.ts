type HummusReadStream = import('../util/hummus-util').HummusReadStream;
type HummusWriteStream = import('../util/hummus-util').HummusWriteStream;

declare module 'hummus' {
  export function createReader(pdfFilename: string): HummusReader;
  export function createReader(pdfStream: HummusReadStream): HummusReader;

  export function createWriter(outputFilename: string): HummusWriter;
  export function createWriter(outputStream: HummusWriteStream): HummusWriter;

  export function createWriterToModify(inputStream: HummusReadStream, outputStream: HummusWriteStream): HummusWriter;

  export enum ERangeType {
    'All' = 0,
    'Specific' = 1,
  }

  export enum EPDFPageBoxType {
    'MediaBox' = 0,
    'CropBox' = 1,
    'BleedBox' = 2,
    'TrimBox' = 3,
    'ArtBox' = 4,
  }

  export let eRangeTypeAll: ERangeType;
  export let eRangeTypeSpecific: ERangeType;

  export let ePDFPageBoxMediaBox: EPDFPageBoxType;
  export let ePDFPageBoxCropBox: EPDFPageBoxType;
  export let ePDFPageBoxBleedBox: EPDFPageBoxType;
  export let ePDFPageBoxTrimBox: EPDFPageBoxType;
  export let ePDFPageBoxArtBox: EPDFPageBoxType;

  export type Dimensions = [number, number, number, number];
  export type PageRange = [number, number];

  export interface HummusReader {
    getPDFLevel: () => void;
    getPagesCount: () => number;
    getTrailer: () => void;
    getPageObjectID: (inPageIndex: number) => void;
    parsePage: (inPageIndex: number) => ParsedPage;
    parsePageDictionary: (inPageIndex: number) => void;
    getObjectsCount: () => void;
    isEncrypted: () => void;
    getXrefSize: () => void;
    getXrefEntry: (inObjectID: number) => void;
    getXrefPosition: () => void;
    getParserStream: () => void;
  }

  export interface HummusWriter {
    createPage: (...dimensions: Dimensions) => PDFPage;
    writePage: (page: PDFPage) => void;
    startPageContentContext(page: PDFPage): ContentContext;
    getModifiedFileParser(): HummusReader;
    appendPDFPagesFromPDF: (
      stream: HummusReadStream,
      opts?: {
        type: ERangeType;
        specificRanges: PageRange[];
      },
    ) => void;
    mergePDFPagesToPage: (
      page: PDFPage,
      stream: HummusReadStream,
      opts?: {
        type: ERangeType;
        specificRanges: PageRange[];
      },
    ) => void;
    getFontForFile: (filename: string) => Font;

    createFormXObjectFromPNG: (image: string | HummusReadStream) => XObject;
    createFormXObjectFromTIFF: (image: string | HummusReadStream) => XObject;
    createFormXObjectFromJPG: (image: string | HummusReadStream) => XObject;

    createFormXObjectsFromPDF: (pdf: string | HummusReadStream, pageBoxType: EPDFPageBoxType) => FormID[];

    getImageDimensions: (...opts: any[]) => any;

    end: () => void;
  }

  export interface FormID {}

  export interface XObject {}

  export interface ParsedPage {
    getMediaBox: () => Dimensions;
    getCropBox: () => Dimensions;
    getTrimBox: () => Dimensions;
    getBleedBox: () => Dimensions;
    getArtBox: () => Dimensions;
  }

  export interface PDFPage {
    mediaBox: Dimensions;
    getResourcesDictionary: () => PDFPageResourcesDictionary;
  }

  export interface PDFPageResourcesDictionary {
    addFormXObjectMapping: (id: FormID) => XObject;
  }

  export interface Font {
    calculateTextDimensions: (
      text: string,
      size: number,
    ) => {
      width: number;
      height: number;
      xMax: number;
      yMax: number;
    };
  }

  export interface TextOptions {
    font: Font;
    size: number;
    color: number;
    colorspace?: string;
  }

  type Matrix = number[];

  export interface ImageOptions {
    index?: number;
    transformation?:
      | Matrix
      | {
          width?: number;
          height?: number;
          proportional?: boolean;
          fit?: string;
        };
  }

  export interface ContentContext {
    writeText: (text: string, x: number, y: number, opts: TextOptions) => ContentContext;
    drawImage: (x: number, y: number, image: string | HummusReadStream, opts?: ImageOptions) => ContentContext;
    doXObject: (xObject: XObject) => ContentContext;

    q: () => ContentContext;
    Q: () => ContentContext;

    cm: (...args: any[]) => ContentContext;
  }

  class PDFPageModifier {
    constructor(writer: HummusWriter, pagenum: number, resetContext?: boolean);

    startContext(): PDFPageModifier;
    getContext(): ContentContext;
    endContext(): PDFPageModifier;

    writePage(): void;
  }
}
