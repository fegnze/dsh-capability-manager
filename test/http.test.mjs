import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandler, HEADER, ROUTE } from '../src/http.mjs';
const owner = { peer: { principal: { kind: 'owner' } } };
const isBrowserPeer = peer => peer === owner.peer;
const browser = { origin: 'http://127.0.0.1:1', 'sec-fetch-site': 'same-origin', cookie: 'session=signed' };
async function send(handler, { method = 'GET', query = '', body, headers = {} } = {}) {
  let status, payload;
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { url: ROUTE + query, method, headers: { [HEADER]: '1', host: '127.0.0.1:1', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } });
  await handler(req, { writeHead: value => { status = value; }, end: value => { payload = JSON.parse(value); } });
  return { status, payload };
}
function fixture() {
  const calls = [];
  const skills = {
    list: async options => { calls.push(['skills.list', options]); return { skills: [] }; },
    detail: async options => { calls.push(['skills.detail', options]); return { skill: { name: options.name } }; },
    local: async () => ({ roots: [], items: [], recovery: [] }),
    raw: async value => ({ raw: '', ...value }),
    recoveryDetail: async value => { calls.push(['skills.recoveryDetail',value]); return { ...value, status:'available' }; },
    preview: async value => ({ previewId: 'p', operation: value.operation }),
    commit: async () => ({ committed: true }),
  };
  const mcp = {
    list: async () => ({ servers: [], external: [] }),
    preview: async () => ({ count: 1 }),
    toggle: async () => ({ saved: true }),
    check: async value => { calls.push(['mcp.check', value]); return { successful: true, method: 'resources/list' }; },
  };
  return { handler: createHandler({ skills, mcp, admit: () => owner, isBrowserPeer }), calls };
}
test('one route, two subjects: the tab selects skills or mcp', async () => {
  const { handler, calls } = fixture();
  assert.equal((await send(handler, { query: '?sessionId=s1' })).payload.value.skills.length, 0);
  assert.equal(calls.at(-1)[0], 'skills.list');
  assert.equal((await send(handler, { query: '?tab=mcp' })).payload.value.servers.length, 0);
  assert.equal((await send(handler, { query: '?action=detail&name=demo' })).payload.value.skill.name, 'demo');
  // A project row is only addressable with the cwd it was listed from.
  await send(handler, { query: '?action=detail&name=demo&cwd=%2Fwork%2Fproject' });
  assert.equal(calls.at(-1)[1].cwd, '/work/project');
  assert.equal((await send(handler, { query: '?tab=other' })).status, 400);
});
test('回收详情和raw保留请求上下文且拒绝未知参数', async()=>{
  const {handler,calls}=fixture();
  const value=await send(handler,{query:'?action=recoveryDetail&rootId=p&recoveryId=r&cwd=%2Fproject'});
  assert.equal(value.status,200);assert.equal(calls.at(-1)[1].cwd,'/project');assert.equal(calls.at(-1)[1].rootId,'p');assert.equal(calls.at(-1)[1].recoveryId,'r');
  const raw=await send(handler,{query:'?action=raw&rootId=p&path=sample.md&cwd=%2Fproject'});
  assert.equal(raw.payload.value.cwd,'/project');
  assert.equal((await send(handler,{query:'?action=recoveryDetail&rootId=p&recoveryId=r&path=unexpected'})).status,400);
});
test('unknown or cross-subject actions are rejected instead of guessed', async () => {
  const { handler, calls } = fixture();
  assert.equal((await send(handler, { query: '?action=import' })).status, 400);
  assert.equal((await send(handler, { query: '?tab=mcp&action=list' })).status, 400);
  assert.equal((await send(handler, { method: 'POST', body: { tab: 'mcp', action: 'preview' }, headers: browser })).status, 200);
  // The probe mutates the manager's check cache, so it is POST-only like the
  // other MCP actions; a GET must not reach it.
  assert.equal((await send(handler, { query: '?tab=mcp&action=check&serverName=demo' })).status, 400);
  assert.equal((await send(handler, { method: 'POST', body: { tab: 'mcp', action: 'check', serverName: 'demo', revision: 'r' }, headers: browser })).payload.value.successful, true);
  assert.equal(calls.at(-1)[0], 'mcp.check');
  assert.equal(calls.at(-1)[1].serverName, 'demo');
  assert.equal((await send(handler, { method: 'POST', body: { tab: 'skills', action: 'toggle' }, headers: browser })).status, 400);
});
test('mutations stay behind the owner peer and the intent header', async () => {
  const { handler } = fixture();
  // A cross-site request cannot add the intent header without a CORS preflight
  // this route never approves, so the header plus admission is the boundary.
  assert.equal((await send(handler, { method: 'POST', body: { action: 'commit', previewId: 'p' }, headers: { [HEADER]: '' } })).status, 403);
  assert.equal((await send(handler, { method: 'POST', body: { action: 'commit', previewId: 'p' } })).status, 200);
  assert.equal((await send(handler, { method: 'POST', body: { action: 'commit', previewId: 'p' }, headers: browser })).status, 200);
  assert.equal((await send(handler, { method: 'POST', body: { tab: 'mcp', action: 'toggle', enabled: true }, headers: browser })).status, 200);
});
test('browser and Electron forwarded requests share browserPeer; owner API peers cannot write', async () => {
  let calls=0;
  const skills={reveal:async()=>{calls++;return {revealed:true};}};
  const handler=createHandler({skills,mcp:{},admit:()=>owner,isBrowserPeer});
  assert.equal((await send(handler,{query:'?action=reveal'})).status,400);
  for(const headers of [browser,{cookie:'desktop-host-session'}]) {
    assert.equal((await send(handler,{method:'POST',body:{action:'reveal',rootId:'r',path:'x'},headers})).status,200);
  }
  assert.equal(calls,2);
  for(const principal of [{kind:'owner'},{kind:'agent'}]) {
    const api=createHandler({skills,mcp:{},admit:()=>({peer:{principal}}),isBrowserPeer});
    assert.equal((await send(api,{method:'POST',body:{action:'reveal'},headers:browser})).status,403);
  }
  const noClassifier=createHandler({skills,mcp:{},admit:()=>owner});
  assert.equal((await send(noClassifier,{method:'POST',body:{action:'reveal'},headers:browser})).status,403);
  for(const rejection of [401,403]) {
    const denied=createHandler({skills,mcp:{},admit:()=>({rejection}),isBrowserPeer});
    assert.equal((await send(denied,{method:'POST',body:{action:'reveal'},headers:browser})).status,rejection);
  }
  assert.equal(calls,2);
});
test('admission, intent header and upstream errors are masked', async () => {
  const denied = createHandler({ skills: {}, mcp: {}, admit: () => ({ rejection: 401 }) });
  assert.equal((await send(denied)).status, 401);
  const failing = createHandler({ skills: { list: async () => { throw new Error('upstream secret'); } }, mcp: {}, admit: () => owner });
  const result = await send(failing);
  assert.equal(result.status, 500);
  assert.deepEqual(result.payload, { ok: false, error: { code: 'OPERATION_FAILED' } });
});
