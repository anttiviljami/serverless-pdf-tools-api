import { spawn } from 'child_process';
import { isError } from 'util';
import Duplexify from 'duplexify';

const operators = Symbol().toString();
const settings = Symbol().toString();

interface ImageMagick {
  [operator: string]: any;
}

class ImageMagick extends Duplexify {
  public input: string;
  public output: string;
  public spawned: boolean;
  private binary: string;

  constructor(binary?: string) {
    super();
    this.input = '-';
    this.output = '-';
    this[operators] = [];
    this[settings] = [];
    this.spawned = false;
    this.binary = binary || 'convert';
  }

  public resume() {
    if (!this.spawned) {
      this.spawn();
    }
    this.spawned = true;
    super.resume();
    return this;
  }

  public set(key: string, val: string | string[] | number | number[]) {
    this[settings].push(`-${key}`);
    if (val == null) {
      return this;
    }
    const values = Array.isArray(val) ? val : [val];
    values.forEach((v: string) => this[settings].push(v));
    return this;
  }

  public op(key: string, val: string | string[] | number | number[]) {
    this[operators].push(`-${key}`);
    if (val == null) {
      return this;
    }
    const values = Array.isArray(val) ? val : [val];
    values.forEach((v: string) => this[settings].push(v));
    return this;
  }

  private spawn() {
    const onerror = this.onerror.bind(this);
    const proc = spawn(this.binary, this.args());

    const stdout = proc.stdout;
    stdout.on('error', onerror);
    this.setReadable(stdout);

    const stdin = proc.stdin;
    stdin.on('error', onerror);
    this.setWritable(stdin);

    const stderr = proc.stderr;
    stderr.on('data', onerror);
    stderr.on('error', onerror);
  }

  private args() {
    return this[settings].concat([this.input], this[operators], [this.output]);
  }

  private onerror(err: Error | string) {
    if (!isError(err)) {
      err = new Error(err);
    }
    if (!this.listeners('error')) {
      throw err;
    }
    this.emit('error', err);
  }
}

export default (bin?: string) => new ImageMagick(bin);
