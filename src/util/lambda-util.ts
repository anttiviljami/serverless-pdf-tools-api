interface ReplyOpts {
  statusCode?: number;
  headers?: { [header: string]: string };
  isBase64Encoded?: boolean;
}

const defaultOpts: ReplyOpts = {
  statusCode: 200,
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true',
  },
};

export async function replyJSON(json: any, opts?: ReplyOpts) {
  const replyOpts: ReplyOpts = {
    ...defaultOpts,
    ...opts,
  };
  return {
    ...replyOpts,
    headers: {
      'content-type': 'application/json',
      ...defaultOpts.headers,
      ...replyOpts.headers,
    },
    body: JSON.stringify(json),
  };
}

export async function replyBase64(buffer: Buffer, opts?: ReplyOpts) {
  const replyOpts: ReplyOpts = {
    ...defaultOpts,
    ...opts,
  };
  return {
    ...replyOpts,
    headers: {
      'content-type': 'application/octet-stream',
      ...defaultOpts.headers,
      ...replyOpts.headers,
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
}
