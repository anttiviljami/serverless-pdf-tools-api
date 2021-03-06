const AWS = require('aws-sdk');
const express = require('express');
const app = express();
const compression = require('compression');
const morgan = require('morgan');

const { Base64Decode } = require('base64-stream');
const { Transform } = require('stream');

app.use(compression());
app.use(morgan('combined'));

AWS.config.region = 'eu-west-1';
const lambda = new AWS.Lambda();

const recipe = {
  layers: [
    {
      url: 'https://s3-eu-west-1.amazonaws.com/serverless-pdf-tools-api-dev/examples/KM_parhaat_pohja.pdf',
    },
    {
      url: 'https://s3-eu-west-1.amazonaws.com/serverless-pdf-tools-api-dev/examples/KM_parhaat_tuote-etu_fasupala.pdf',
    },
  ],
  fonts: [
    {
      family: 'arial',
      url: 'https://s3-eu-west-1.amazonaws.com/serverless-pdf-tools-api-dev/fonts/arial.ttf',
    },
  ],
  elements: [
    {
      type: 'image',
      url: 'https://public.keskofiles.com/f/k-ruoka/product/4009301043187?w=500?fm=png',
      page: 0,
      x: 250,
      y: 500,
      height: 100,
      rotation: -45,
    },
    {
      type: 'image',
      url: 'https://public.keskofiles.com/f/k-ruoka/product/4009301043187?w=500?fm=png',
      page: 1,
      x: 250,
      y: 500,
      height: 100,
      rotation: 45,
    },
    {
      type: 'html',
      html: "<h1 style='color:red;background:white'>THIS IS A HTML ELEMENT</h1>",
      page: 0,
      x: 50,
      y: 100,
      width: 200,
      height: 200,
      pageWidth: '155mm',
      pageHeight: '30mm',
      rotation: 0,
    },
    {
      type: 'text',
      page: 0,
      x: 200,
      y: 650,
      width: 150,
      text: 'First line\nSecond line\nThis is a really long line that should be automatically cut',
      font: 'arial',
      size: 12,
      color: '0,0,0,100',
      lineHeight: 1.6,
      align: 'center',
      rotation: 20,
    },
  ],
};

const html = `<html>
<head><title>Not important</title></head>
<body>
<h1>Hello World</h1>
<p>Lorem</p>
</body>
</html>`;

app.get('/pdf', async (req, res) => {
  try {
    lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME_PDF,
        Payload: JSON.stringify({ recipe, output: { type: 'pdf' } }),
      })
      .createReadStream()
      .pipe(stripFirstAndLastByte())
      .pipe(new Base64Decode())
      .pipe(res);
    return res.status(200).type('application/pdf');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err });
  }
});

app.get('/pdf/montage', async (req, res) => {
  try {
    lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME_PDF,
        Payload: JSON.stringify({ recipe, output: { type: 'montage', opts: { montagePages: [0, 1] } } }),
      })
      .createReadStream()
      .pipe(stripFirstAndLastByte())
      .pipe(new Base64Decode())
      .pipe(res);
    return res.status(200).type('image/png');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err });
  }
});

app.get('/pdf/cover', async (req, res) => {
  try {
    lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME_PDF,
        Payload: JSON.stringify({ recipe, output: { type: 'cover' } }),
      })
      .createReadStream()
      .pipe(stripFirstAndLastByte())
      .pipe(new Base64Decode())
      .pipe(res);
    return res.status(200).type('image/png');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err });
  }
});

app.get('/html/screenshot', async (req, res) => {
  try {
    lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME_HTML,
        Payload: JSON.stringify({ html, output: { type: 'screenshot' } }),
      })
      .createReadStream()
      .pipe(stripFirstAndLastByte())
      .pipe(new Base64Decode())
      .pipe(res);
    return res.status(200).type('image/png');
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err });
  }
});

app.get('/html/pdf', async (req, res) => {
  try {
    lambda
      .invoke({
        FunctionName: process.env.FUNCTION_NAME_HTML,
        Payload: JSON.stringify({ html, output: { type: 'pdf' } }),
      })
      .createReadStream()
      .pipe(stripFirstAndLastByte())
      .pipe(new Base64Decode())
      .pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err });
  }
});

app.listen(8080, () => console.info('listening at http://localhost:8080'));

function stripFirstAndLastByte() {
  let isFirst = true;
  return new Transform({
    transform(chunk, _, callback) {
      if (isFirst) {
        // strip first byte
        isFirst = false;
        return callback(null, chunk.slice(1));
      } else {
        const isLast = chunk.slice(-1)[0] === 34;
        if (isLast) {
          // strip last byte
          return callback(null, chunk.slice(0, -1));
        }
      }
      return callback(null, chunk);
    },
  });
}
