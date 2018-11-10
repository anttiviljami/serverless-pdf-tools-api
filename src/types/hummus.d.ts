type HummusReadStream = import('../util/hummus-util').HummusReadStream;
type HummusWriteStream = import('../util/hummus-util').HummusWriteStream;

declare module 'hummus' {
  export function createReader(inputStream: HummusReadStream): HummusReader;

  export function createWriter(outputFilename: string): HummusWriter;
  export function createWriter(outputStream: HummusWriteStream): HummusWriter;

  export let eRangeTypeSpecific: ERangeType;

  export type Dimensions = [number, number, number, number];
  export type PageRange = [number, number];

  export enum ERangeType {
    'Specific' = 1,
  }

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
    mergePDFPagesToPage: (
      page: PDFPage,
      stream: HummusReadStream,
      mergeOpts: {
        type: ERangeType;
        specificRanges: PageRange[];
      },
    ) => void;
    end: () => void;
  }

  export interface ParsedPage {
    getMediaBox: () => Dimensions;
    getCropBox: () => Dimensions;
    getTrimBox: () => Dimensions;
    getBleedBox: () => Dimensions;
    getArtBox: () => Dimensions;
  }

  export interface PDFPage {
    mediaBox: Dimensions;
  }
}
