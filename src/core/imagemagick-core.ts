import im from '../util/imagemagick-util';
import * as perf from '../util/perf';

export interface PDFToImageStreamOpts {
  type?: 'cover' | 'montage';
  montagePages?: number[];
  colorspace?: string;
  density?: number;
  alpha?: string;
  quality?: number;
  resize?: number;
}

export function pdfToImageStream(opts?: PDFToImageStreamOpts) {
  const imageMagickOpts = {
    type: 'cover',
    colorspace: 'sRGB',
    density: 140,
    alpha: 'remove',
    quality: 90,
    ...opts,
  };

  const { type } = imageMagickOpts;

  // choose suitable executable based on image type
  let executable = 'convert';
  if (type === 'montage') {
    executable = 'montage';
  }

  // set opts
  const convert = im(executable);
  if (imageMagickOpts.colorspace) {
    convert.set('colorspace', imageMagickOpts.colorspace);
  }
  if (imageMagickOpts.density) {
    convert.set('density', imageMagickOpts.density);
  }
  if (imageMagickOpts.resize) {
    convert.set('resize', imageMagickOpts.resize);
  }
  if (imageMagickOpts.alpha) {
    convert.set('alpha', imageMagickOpts.alpha);
  }
  if (imageMagickOpts.quality) {
    convert.set('quality', imageMagickOpts.quality);
  }
  if (type === 'montage') {
    convert.set('mode', 'Concatenate').set('tile', '2x');
  }

  const inputPages = opts.montagePages ? opts.montagePages.join(',') : '0';

  convert.input = `-[${inputPages}]`;
  convert.output = 'png:-';

  const timer = `pdfToImage-${new Date().getTime()}`;
  convert.on('data', function startListener() {
    perf.time(timer, `Started converting pdf to ${type}`);
    convert.removeListener('data', startListener);
  });
  convert.on('end', () => perf.timeEnd(timer, `Finished converting to ${type}`));

  return convert;
}
