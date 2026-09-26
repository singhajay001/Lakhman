import { createHash } from 'node:crypto';
import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A local S3-compatible server, for proving the storage adapter against a real socket.
 *
 * It exists because the alternative is mocking `@aws-sdk/client-s3`, and a mocked SDK cannot tell
 * you the thing worth knowing: that the client addresses the bucket the way this endpoint expects,
 * signs its requests, and reads back the exact bytes it wrote. Those are properties of the wire,
 * not of the call.
 *
 * It answers **path-style requests only** — `/<bucket>/<key>`. That is deliberate. A client left
 * on the SDK's default virtual-host addressing would ask for `<bucket>.<host>/<key>`, which
 * against a fixed endpoint resolves to a hostname that does not exist; here it arrives as a path
 * this server rejects, so the test fails loudly instead of the mistake surviving to staging.
 *
 * What it does **not** do is verify SigV4. It records that an `AWS4-HMAC-SHA256` credential was
 * presented and does not recompute it, so these tests prove the client signs and not that the
 * signature is correct — a real endpoint proves the latter. Nothing here is billable and nothing
 * leaves the machine.
 */
export interface S3ServerRequest {
  method: string;
  path: string;
  /** The signing algorithm presented, or null. Never the signature itself. */
  authScheme: string | null;
  host: string;
}

export interface S3TestServerOptions {
  /** Buckets that exist. A request for any other gets NoSuchBucket. */
  buckets: string[];
  /** Keys that answer 403 instead of their contents, for proving denial is not absence. */
  forbidden?: Set<string>;
}

export class S3TestServer {
  private readonly server: Server;
  private readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();
  private readonly buckets: Set<string>;
  private readonly forbidden: Set<string>;
  readonly requests: S3ServerRequest[] = [];

  constructor(options: S3TestServerOptions) {
    this.buckets = new Set(options.buckets);
    this.forbidden = options.forbidden ?? new Set();
    this.server = createServer((req, res) => {
      const auth = req.headers.authorization ?? '';
      this.requests.push({
        method: req.method ?? '',
        path: req.url ?? '',
        authScheme: auth ? (auth.split(' ')[0] ?? null) : null,
        host: req.headers.host ?? '',
      });

      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          this.route(req.method ?? '', req.url ?? '', Buffer.concat(chunks), req.headers, res);
        } catch {
          error(res, 500, 'InternalError', 'the test server failed');
        }
      });
    });
  }

  private route(
    method: string,
    url: string,
    body: Buffer,
    headers: IncomingHttpHeaders,
    res: ServerResponse,
  ): void {
    // `/<bucket>/<key...>`, with the query string discarded. A virtual-host request arrives as
    // `/<key...>` and therefore names a bucket that does not exist, which is the intended failure.
    const path = (url.split('?')[0] ?? '').replace(/^\//, '');
    const slash = path.indexOf('/');
    if (slash <= 0) {
      error(res, 400, 'InvalidRequest', 'path-style addressing is required by this endpoint');
      return;
    }

    const bucket = decodeURIComponent(path.slice(0, slash));
    const key = path
      .slice(slash + 1)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');

    if (!this.buckets.has(bucket)) {
      error(res, 404, 'NoSuchBucket', `no such bucket: ${bucket}`);
      return;
    }
    if (key === '') {
      error(res, 400, 'InvalidRequest', 'a key is required');
      return;
    }

    const id = `${bucket}/${key}`;

    if (this.forbidden.has(key)) {
      // A denial, not an absence. The adapter must surface this rather than return null.
      error(res, 403, 'AccessDenied', 'access denied');
      return;
    }

    if (method === 'PUT') {
      const contentType = str(headers['content-type']) ?? 'application/octet-stream';
      // A later PUT to the same key replaces the object, which is what the local store does.
      this.objects.set(id, { bytes: body, contentType });
      res.writeHead(200, { ETag: `"${createHash('md5').update(body).digest('hex')}"` });
      res.end();
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      const object = this.objects.get(id);
      if (!object) {
        error(res, 404, 'NoSuchKey', `no such key: ${key}`);
        return;
      }
      res.writeHead(200, {
        'Content-Type': object.contentType,
        'Content-Length': String(object.bytes.byteLength),
        ETag: `"${createHash('md5').update(object.bytes).digest('hex')}"`,
      });
      res.end(method === 'HEAD' ? undefined : object.bytes);
      return;
    }

    error(res, 405, 'MethodNotAllowed', `${method} is not supported`);
  }

  async start(): Promise<string> {
    await new Promise<void>((done) => this.server.listen(0, '127.0.0.1', done));
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((done, fail) => this.server.close((err) => (err ? fail(err) : done())));
  }

  /** What is actually stored, for asserting bytes independently of the adapter that wrote them. */
  stored(bucket: string, key: string): Buffer | undefined {
    return this.objects.get(`${bucket}/${key}`)?.bytes;
  }

  get objectCount(): number {
    return this.objects.size;
  }
}

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function error(res: ServerResponse, status: number, code: string, message: string): void {
  // The XML shape the SDK parses `Code` out of and turns into the error's name, which is how the
  // adapter tells NoSuchKey from AccessDenied.
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;
  res.writeHead(status, { 'Content-Type': 'application/xml' });
  res.end(xml);
}
