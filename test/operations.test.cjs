const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TvarkaSign } = require('../dist/nodes/TvarkaSign/TvarkaSign.node');
const { TvarkaSignApi } = require('../dist/credentials/TvarkaSignApi.credentials');
const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

function context(params, responses = [], options = {}) {
  const calls = [];
  const node = new TvarkaSign();
  const ctx = {
    getNode: () => ({ name: 'TVARKA Sign', type: 'n8n-nodes-tvarka-sign.tvarkaSign', typeVersion: 1, position: [0, 0], parameters: params }),
    getNodeParameter: (name, i) => (Array.isArray(params) ? params[i] : params)[name],
    getInputData: () => options.items || [{ json: {} }],
    continueOnFail: () => Boolean(options.continueOnFail),
    helpers: {
      httpRequestWithAuthentication: async function (credential, request) {
        assert.equal(this, ctx);
        assert.equal(credential, 'tvarkaSignApi');
        assert.equal(request.disableFollowRedirect, true);
        assert.match(request.url, /^https:\/\/sign-api\.tvarka\.pro\/v1\//);
        calls.push(request);
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return response;
      },
      assertBinaryData: (_i, name) => { assert.equal(name, 'data'); return { fileName: options.fileName || 'contract.pdf' }; },
      getBinaryDataBuffer: async () => options.bytes || Buffer.from('%PDF-1.7\nexample'),
      prepareBinaryData: async (bytes, fileName, mimeType) => ({ data: bytes.toString('base64'), fileName, mimeType }),
    },
  };
  return { calls, run: () => node.execute.call(ctx) };
}

test('credential uses bearer authentication and a read-only test', () => {
  const c = new TvarkaSignApi();
  assert.equal(c.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
  assert.equal(c.test.request.url, '/v1/signings');
  assert.deepEqual(c.test.request.qs, { limit: 1 });
  assert.equal(c.properties[0].typeOptions.password, true);
});

const create = { operation: 'create', title: 'Agreement', documentName: 'contract.pdf', fileToken: ID,
  idempotencyKey: 'crm:123:revision:2', signers: { signer: [{ email: 'signer@example.com', name: '', language: 'en' }] },
  delivery: 'link', additionalFields: { signingOrder: 'sequential', expiresInDays: 7, externalId: 'crm:123' } };

test('create preserves the business idempotency key and contract fields', async () => {
  const c = context(create, [{ signingId: ID, status: 'pending' }]);
  const [out] = await c.run();
  assert.equal(c.calls[0].method, 'POST');
  assert.equal(c.calls[0].headers['Idempotency-Key'], create.idempotencyKey);
  assert.deepEqual(c.calls[0].body, { title: 'Agreement', document: { name: 'contract.pdf', fileToken: ID },
    signers: [{ email: 'signer@example.com', language: 'en' }], delivery: 'link', ...create.additionalFields });
  assert.equal(out[0].json.status, 'pending');
  assert.deepEqual(out[0].pairedItem, { item: 0 });
});

test('missing signers, invalid token and unsafe idempotency key fail before transport', async () => {
  for (const patch of [{ signers: {} }, { fileToken: '../../secret' }, { idempotencyKey: 'bad\r\nheader' }]) {
    const c = context({ ...create, ...patch });
    await assert.rejects(c.run());
    assert.equal(c.calls.length, 0);
  }
});

test('multipart upload preserves binary bytes and avoids boundary collisions', async () => {
  const bytes = Buffer.from([0, 255, ...Buffer.from('tvarkaN8nBoundary'), 0, 128]);
  const c = context({ operation: 'upload', binaryPropertyName: 'data', fileName: '' }, [{ fileToken: ID }], { bytes });
  await c.run();
  const r = c.calls[0];
  assert.equal(r.url, 'https://sign-api.tvarka.pro/v1/files');
  const boundary = r.headers['Content-Type'].split('boundary=')[1];
  assert.equal(boundary, 'tvarkaN8nBoundaryx');
  const start = r.body.indexOf(Buffer.from('\r\n\r\n')) + 4;
  assert.deepEqual(r.body.subarray(start, start + bytes.length), bytes);
  assert.ok(r.body.toString().includes('name="file"; filename="contract.pdf"'));
});

test('unsafe filenames, empty files and oversized files never reach API', async () => {
  for (const opts of [{ fileName: 'x"\r\nInjected: true' }, { bytes: Buffer.alloc(0) }, { bytes: Buffer.alloc(100000001) }]) {
    const c = context({ operation: 'upload', binaryPropertyName: 'data', fileName: '' }, [], opts);
    await assert.rejects(c.run());
    assert.equal(c.calls.length, 0);
  }
});

test('listing follows nextCursor and returns individual linked items', async () => {
  const c = context({ operation: 'getAll', returnAll: true, status: 'completed' }, [
    { data: [{ signingId: ID }], hasMore: true, nextCursor: ID },
    { data: [{ signingId: ID2 }], hasMore: false, nextCursor: null },
  ]);
  const [out] = await c.run();
  assert.equal(out.length, 2);
  assert.deepEqual(c.calls[1].qs, { limit: 100, status: 'completed', startingAfter: ID });
});

test('listing respects requested total limit', async () => {
  const c = context({ operation: 'getAll', returnAll: false, limit: 1, status: '' }, [
    { data: [{ signingId: ID }, { signingId: ID2 }], hasMore: true, nextCursor: ID2 },
  ]);
  const [out] = await c.run();
  assert.equal(out.length, 1);
  assert.equal(c.calls.length, 1);
});

test('repeated cursors fail instead of polling indefinitely', async () => {
  const page = { data: [{ signingId: ID }], hasMore: true, nextCursor: ID };
  const c = context({ operation: 'getAll', returnAll: true, status: '' }, [page, page]);
  await assert.rejects(c.run(), /cursor/);
  assert.equal(c.calls.length, 2);
});

test('get, cancel and remind use the expected scoped paths', async () => {
  for (const [operation, method, suffix] of [['get', 'GET', ''], ['cancel', 'POST', '/cancel'], ['remind', 'POST', `/signers/${ID2}/remind`]]) {
    const c = context({ operation, signingId: ID, signerId: ID2 }, [{ signingId: ID }]);
    await c.run();
    assert.equal(c.calls[0].method, method);
    assert.equal(c.calls[0].url, `https://sign-api.tvarka.pro/v1/signings/${ID}${suffix}`);
  }
});

test('download preserves bytes, sandbox marker and server filename', async () => {
  const bytes = Buffer.from([37, 80, 68, 70, 255, 0]);
  const c = context({ operation: 'download', signingId: ID, outputBinaryField: 'signed' }, [{ body: bytes,
    headers: { 'content-type': 'application/pdf', 'content-disposition': "attachment; filename*=UTF-8''sutartis%20signed.pdf",
      'x-tvarka-sandbox': 'simulated-artifact-no-signature', 'x-tvarka-document-sha256': 'abc123' } }]);
  const [out] = await c.run();
  assert.deepEqual(Buffer.from(out[0].binary.signed.data, 'base64'), bytes);
  assert.equal(out[0].binary.signed.fileName, 'sutartis signed.pdf');
  assert.equal(out[0].json.sandbox, true);
  assert.equal(out[0].json.sha256, 'abc123');
  assert.equal(c.calls[0].encoding, 'arraybuffer');
});

test('download normalizes unsafe server paths', async () => {
  const c = context({ operation: 'download', signingId: ID, outputBinaryField: 'data' }, [{ body: Buffer.from('doc'),
    headers: { 'content-disposition': 'attachment; filename="../doc.pdf"' } }]);
  const [out] = await c.run();
  assert.equal(out[0].json.fileName, '.._doc.pdf');
});

test('API errors stop execution by default without implicit retries', async () => {
  const c = context({ operation: 'get', signingId: ID }, [new Error('429 Too Many Requests')]);
  await assert.rejects(c.run(), /429/);
  assert.equal(c.calls.length, 1);
});

test('continue on fail retains item pairing and continues subsequent items', async () => {
  const c = context([{ operation: 'get', signingId: 'invalid' }, { operation: 'get', signingId: ID }], [{ signingId: ID }],
    { continueOnFail: true, items: [{ json: {} }, { json: {} }] });
  const [out] = await c.run();
  assert.match(out[0].json.error, /UUID/);
  assert.equal(out[1].json.signingId, ID);
  assert.deepEqual(out[1].pairedItem, { item: 1 });
});
