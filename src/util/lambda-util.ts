interface ReplyOpts {
  statusCode?: number;
  headers?: { [header: string]: string };
}

const defaultOpts: ReplyOpts = {
  statusCode: 200,
  headers: {
    'content-type': 'application/json',
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
      ...defaultOpts.headers,
      ...replyOpts.headers,
    },
    body: JSON.stringify(json),
  };
}
