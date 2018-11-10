export default class HummusReadStream {
  public buffer: Buffer;
  public index: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.index = 0;
    return this;
  }

  public read(bytes: number) {
    const target = Buffer.alloc(bytes);
    this.buffer.copy(target, 0, this.index, this.index + bytes);
    this.index += bytes;
    return [...target];
  }

  public getCurrentPosition() {
    return this.index;
  }
  public setPosition(pos: number) {
    this.index = pos;
  }
  public setPositionFromEnd(pos: number) {
    this.index = this.buffer.length - pos;
  }
  public skip(len: number) {
    this.index += len;
  }
  public close(callback: () => void) {
    delete this.buffer;
    callback();
  }
  public notEnded() {
    return this.index < this.buffer.length;
  }
}
