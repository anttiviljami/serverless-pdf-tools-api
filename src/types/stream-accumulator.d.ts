type Readable = import('stream').Readable;

declare module 'stream-accumulator' {
  function promise(stream: Readable): Promise<Buffer>;
}
