// Optional local-backend acceptance driver. JSON-lines transport is provided by
// a test runner; it never reads credentials or contacts production by itself.
const readline = require('node:readline');
const assert = require('node:assert/strict');
const { TvarkaSign } = require('../dist/nodes/TvarkaSign/TvarkaSign.node');
const lines = readline.createInterface({ input: process.stdin });
const queue = []; const waiters = [];
lines.on('line', l => { const next = waiters.shift(); if (next) next(JSON.parse(l)); else queue.push(JSON.parse(l)); });
const receive = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(r => waiters.push(r));
async function transport(options) {
  process.stdout.write(JSON.stringify({ request: { ...options, body: Buffer.isBuffer(options.body) ? { base64: options.body.toString('base64') } : options.body } }) + '\n');
  const r = await receive();
  if (r.status >= 400) throw new Error(`Backend ${r.status}: ${JSON.stringify(r.json)}`);
  return options.returnFullResponse ? { body: Buffer.from(r.base64, 'base64'), headers: r.headers } : r.json;
}
async function run(params, pdf) {
  const ctx = {
    getNode: () => ({ name: 'TVARKA Sign', type: 'n8n-nodes-tvarka-sign.tvarkaSign', parameters: params }),
    getNodeParameter: name => params[name], getInputData: () => [{ json: {} }], continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: async (_name, options) => transport(options),
      assertBinaryData: () => ({ fileName: 'acceptance.pdf' }), getBinaryDataBuffer: async () => pdf,
      prepareBinaryData: async (bytes, fileName, mimeType) => ({ data: bytes.toString('base64'), fileName, mimeType }),
    },
  };
  return (await new TvarkaSign().execute.call(ctx))[0];
}
(async () => {
  const fixture = await receive();
  const pdf = Buffer.from(fixture.pdf, 'base64');
  const upload = (await run({ operation: 'upload', binaryPropertyName: 'data', fileName: '' }, pdf))[0].json;
  assert.ok(upload.fileToken);
  const params = { operation: 'create', title: 'n8n local acceptance', documentName: 'acceptance.pdf', fileToken: upload.fileToken,
    idempotencyKey: 'n8n:local-acceptance', signers: { signer: [{ email: 'signer@example.test', language: 'en' }] }, delivery: 'link', additionalFields: {} };
  const created = (await run(params))[0].json;
  assert.equal(created.status, 'pending');
  assert.ok(created.signers[0].ceremonyUrl);
  const replay = (await run(params))[0].json;
  assert.equal(replay.signingId, created.signingId);
  const listed = await run({ operation: 'getAll', returnAll: true, status: 'pending' });
  assert.ok(listed.some(i => i.json.signingId === created.signingId));
  await transport({ method: 'POST', url: `https://sign-api.tvarka.pro/v1/signings/${created.signingId}/simulate`, body: { action: 'complete' }, json: true });
  const completed = (await run({ operation: 'get', signingId: created.signingId }))[0].json;
  assert.equal(completed.status, 'completed');
  const downloaded = (await run({ operation: 'download', signingId: created.signingId, outputBinaryField: 'data' }))[0];
  assert.equal(downloaded.json.sandbox, true);
  assert.ok(Buffer.from(downloaded.binary.data.data, 'base64').subarray(0, 5).equals(Buffer.from('%PDF-')));
  process.stdout.write(JSON.stringify({ done: true, checks: ['multipart upload', 'create', 'idempotent replay', 'list', 'sandbox simulation', 'get completed status', 'binary download with sandbox marker'] }) + '\n');
  lines.close();
})().catch(e => { process.stderr.write(e.stack + '\n'); lines.close(); process.exitCode = 1; });
