import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createAssistantControl, registerAssistantQueryTool } from '../src/assistant-control.mjs';
import { createHandler, ROUTE, HEADER } from '../src/http.mjs';
import { AssistantError } from '../src/assistants/errors.mjs';

function fixture() {
  const calls = [];
  const runtime = {
    list: async args => { calls.push(['list', args]); return { assistants: [], binding: null, available: true, issues: [] }; },
    detail: async args => { calls.push(['detail', args]); return { manifest: { id: args.id } }; },
    previewBind: async args => { calls.push(['previewBind', args]); return { revision: 'receipt', canBind: true }; },
    bind: async args => { calls.push(['bind', args]); return { phase: 'bound', sessionId: args.sessionId }; },
    readBinding: id => { calls.push(['binding', id]); return { phase: 'unbound', sessionId: id, canSubmit: true }; },
  };
  const peer = { principal: { kind: 'owner' }, signal: new AbortController().signal };
  const control = createAssistantControl(runtime);
  const handler = createHandler({ skills: {}, mcp: {}, assistants: control, admit: () => ({ peer }), isBrowserPeer: candidate => candidate === peer });
  return { calls, runtime, control, peer, handler };
}
async function send(handler, { method = 'GET', query = '', body } = {}) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, { method, url: ROUTE + query, headers: { [HEADER]: '1', ...(body ? { 'content-type': 'application/json' } : {}) } });
  let status, payload;
  await handler(req, { writeHead(code) { status = code; }, end(text) { payload = JSON.parse(text); } });
  return { status, ...payload };
}

test('assistant control validates subject, required fields and unknown input', async () => {
  const { control, calls } = fixture();
  await control.read('list', { sessionId: 's' });
  assert.equal(calls.at(-1)[0], 'list');
  assert.equal((await control.read('binding', { sessionId: 's' })).phase, 'unbound');
  for (const [action, input] of [['bind', {}], ['detail', {}], ['binding', {}], ['list', { id: 'extra' }], ['list', { sessionId: '' }], ['detail', { id: 'x', signal: 'injected' }]]) {
    await assert.rejects(control.read(action, input));
  }
  await assert.rejects(control.query('bind', { sessionId: 's', id: 'a', revision: 'r', confirm: true }), { code: 'UNSUPPORTED_ACTION' });
  await assert.rejects(control.write('bind', { sessionId: 's', id: 'a', revision: 'r', confirm: false }), { code: 'CONFIRM_REQUIRED' });
});

test('HTTP assistant queries and preview share the control plane and peer signal', async () => {
  const { handler, calls, peer } = fixture();
  assert.equal((await send(handler, { query: '?tab=assistants&action=list&sessionId=s' })).status, 200);
  assert.equal(calls.at(-1)[1].signal, peer.signal);
  assert.equal((await send(handler, { query: '?tab=assistants&action=detail&id=a&sessionId=s' })).value.manifest.id, 'a');
  assert.equal((await send(handler, { query: '?tab=assistants&action=binding&sessionId=s' })).value.canSubmit, true);
  const preview = await send(handler, { method: 'POST', body: { tab: 'assistants', action: 'previewBind', id: 'a', sessionId: 's' } });
  assert.equal(preview.value.revision, 'receipt');
  assert.equal((await send(handler, { method: 'POST', body: { tab: 'assistants', action: 'bind', id: 'a', sessionId: 's', revision: 'receipt', confirm: true } })).value.phase, 'bound');
  for (const query of ['?tab=assistants&action=bind', '?tab=assistants&action=previewBind&id=a', '?tab=assistants&action=list&sessionId=a&sessionId=b', '?tab=assistants&action=list&tab=skills', '?tab=assistants&action=list&unexpected=value']) {
    assert.equal((await send(handler, { query })).status, 400);
  }
});

test('non-browser owner cannot bind or preview through HTTP', async () => {
  const { control, calls } = fixture();
  const handler = createHandler({ skills: {}, mcp: {}, assistants: control, admit: () => ({ peer: { principal: { kind: 'owner' } } }), isBrowserPeer: () => false });
  for (const action of ['previewBind', 'bind']) {
    assert.equal((await send(handler, { method: 'POST', body: { tab: 'assistants', action, id: 'a', sessionId: 's', revision: 'r', confirm: true } })).status, 403);
  }
  assert.equal(calls.length, 0);
});

test('AssistantError exposes only fixed code; arbitrary upstream error stays masked', async () => {
  const { handler, runtime } = fixture();
  runtime.list = async () => { throw new AssistantError('STALE_BINDING', 409); };
  assert.deepEqual(await send(handler, { query: '?tab=assistants' }), { status: 409, ok: false, error: { code: 'STALE_BINDING' } });
  runtime.list = async () => { throw new Error('private credential'); };
  assert.deepEqual(await send(handler, { query: '?tab=assistants' }), { status: 500, ok: false, error: { code: 'OPERATION_FAILED' } });
});

test('model query tool uses current session and never exposes confirmation authority', async () => {
  const { control, calls } = fixture();
  let tool;
  const off = () => {};
  assert.equal(registerAssistantQueryTool({ tools: { register(definition) { tool = definition; return off; } }, agents: { currentInitiator: () => ({ id: 'current' }) } }, control), off);
  assert.deepEqual(tool.parameters.properties.action.enum, ['list', 'detail', 'binding', 'previewBind']);
  const signal = new AbortController().signal;
  await tool.execute({ action: 'previewBind', id: 'a' }, { signal });
  assert.equal(calls.at(-1)[1].sessionId, 'current');
  assert.equal(calls.at(-1)[1].signal, signal);
  await assert.rejects(tool.execute({ action: 'bind', id: 'a', confirm: true, revision: 'r' }, { signal }), { code: 'UNSUPPORTED_ACTION' });
});
