import { Readable, Writable } from 'stream';

export default class HummusWriteStream {
  public output: Readable;
  public index: number;

  constructor() {
    this.output = new Readable({
      read: () => null,
    });
    this.index = 0;
  }

  public write(inBytesArray: Uint8Array[]) {
    if (inBytesArray.length > 0) {
      this.output.push(new Buffer(inBytesArray));
      this.index += inBytesArray.length;
      return inBytesArray.length;
    } else {
      return 0;
    }
  }

  public getCurrentPosition() {
    return this.index;
  }

  public pipe(out: Writable) {
    return this.output.pipe(out);
  }

  public on(event: string, callback: (...args: any[]) => void) {
    return this.output.on(event, callback);
  }

  public end() {
    return this.output.push(null); // EOF
  }
}
