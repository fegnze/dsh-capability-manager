import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { Session } from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import { createScope, bindScopeParent } from '@deepseek-ai/dsh-scope';
import { evidenceProjection, bindingNotice, EVIDENCE_KEY } from '../src/assistants/evidence.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import { domainSpec } from '../src/assistants/schema.mjs';
import { createAssistantRuntime } from '../src/assistants/index.mjs';

test('native JSON storage initializes assistant runtime and admits unbound new and resumed sessions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-assistant-storage-test-'));
  const ctx = new Context();
  let runtime;
  try {
    await ctx.plugin(Storage);
    await ctx.plugin(StorageJson, { root });
    await ctx.plugin(StorageDomain, { backend: 'json', routes: {} });
    await ctx.plugin(SessionProjectionRegistry);
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    const old = Session.create('resumed-session');
    old.append('turn/start', { turn: 1 });
    old.append('turn/end', { turn: 1, reason: { kind: 'blocked' } });
    const sessions = [Session.create('new-session'), Session.create(old.id, old.snapshotEvents(), old.header, 0)];
    const agents = sessions.map(session => ({ id: session.id, session, ctx, status: 'idle', inbox: { nextTurn: [], nextStep: [] } }));
    ctx.provide('agents', { get: id => agents.find(agent => agent.id === id), list: () => agents });
    ctx.provide('sessions', { flush: async () => true });
    // Exercise the actual validator and backend, not a permissive open() mock.
    assert.throws(() => StorageDomain.defineDomain({ ...domainSpec, name: 'dsh-assistants' }), /domain name/);
    await assert.rejects(ctx.get('storageDomain').open({ ...domainSpec, name: 'dsh-assistants' }), { code: 'malformed-medium' });
    runtime = createAssistantRuntime(ctx);
    await runtime.ready;
    const availability = await runtime.list();
    assert.equal(availability.available, true, JSON.stringify(availability.issues));
    for (const agent of agents) {
      const view = runtime.readBinding(agent.id);
      assert.equal(view.phase, 'unbound');
      assert.equal(view.reason, null);
      assert.equal(view.canSubmit, true);
      const payload = { agent, signal: new AbortController().signal };
      assert.equal((await ctx.waterfall('agent/pre-step', payload, async () => ({ kind: 'enter', messages: [] }))).kind, 'enter');
      assert.deepEqual(await ctx.waterfall('agent/request', payload, async () => ({ provider: 'test' })), { provider: 'test' });
    }
    await runtime.dispose();
    runtime = null;
    // Verify durable writes and cold reopen through the real JSON backend.
    const record = { schemaVersion: 1, sessionId: 'bound-session', selectionId: 'selection', identity: { assistantId: 'test-assistant', packageName: '@test/assistant', packageVersion: '1.0.0', contentDigest: 'a'.repeat(64), requiredPreset: null }, revision: 1, phase: 'bound', reason: null, boundAt: 1 };
    let domain = await ctx.get('storageDomain').open(domainSpec);
    await domain.table('bindings').put(record.sessionId, record);
    await domain.close();
    domain = await ctx.get('storageDomain').open(domainSpec);
    assert.deepEqual(domain.table('bindings').get(record.sessionId), record);
    await domain.close();
  } finally {
    await runtime?.dispose();
    await ctx.fiber.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test('native Cordis projection registry folds binding evidence and cold restore',async()=>{
  const ctx=new Context();
  await ctx.plugin(SessionProjectionRegistry);
  const off=ctx.sessionProjections.register(evidenceProjection);
  const session=Session.create('native-evidence');
  const record={sessionId:session.id,selectionId:'selection',identity:{assistantId:'test-assistant',packageName:'@test/assistant',packageVersion:'1.0.0',contentDigest:'a'.repeat(64),requiredPreset:null}};
  session.append('agent/inbox/spliced',{target:'next-step',start:0,inserted:[bindingNotice(record)]});
  const state=ctx.sessionProjections.stateOf(session,EVIDENCE_KEY);
  assert.equal(state.marker.selectionId,'selection');
  const restored=Session.create(session.id,session.snapshotEvents(),session.header,0);
  assert.equal(ctx.sessionProjections.stateOf(restored,EVIDENCE_KEY).marker.identity.assistantId,'test-assistant');
  off();assert.equal(ctx.sessionProjections.stateOf(restored,EVIDENCE_KEY),undefined);
  await ctx.fiber.dispose();
});

test('native scoped tools and prompt survive parent rebind without leaking to another Agent',async()=>{
  const ctx=new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  const a={}, b={}, presetA={}, presetB={};
  const scopeA=createScope(ctx,a), scopeB=createScope(ctx,b);
  const parent=bindScopeParent(a,presetA);
  const originalContext=scopeA.ctx;
  const offTool=scopeA.ctx.get('tools').register({name:'assistant_native_test',description:'Test only',parameters:{type:'object',properties:{}},execute:async()=>({}),output:{schema:{type:'object'},render:()=>[]}});
  const offSection=scopeA.ctx.get('systemPrompt').section({name:'assistant-native-test',order:100,text:'Scoped assistant instructions'});
  assert.equal(ctx.tools.schemas(a).some(row=>row.name==='assistant_native_test'),true);
  assert.equal(ctx.tools.schemas(b).some(row=>row.name==='assistant_native_test'),false);
  assert.equal((await ctx.systemPrompt.assemble({scope:a})).sections.some(row=>row.name==='assistant-native-test'),true);
  assert.equal((await ctx.systemPrompt.assemble({scope:b})).sections.some(row=>row.name==='assistant-native-test'),false);
  // Native preset recomposition rebinds the scope parent, it does not replace
  // the Agent scope. This exercises that exact primitive without a Loader/profile.
  parent.rebind(presetB);
  assert.equal(scopeA.ctx,originalContext);
  assert.equal(ctx.tools.schemas(a).some(row=>row.name==='assistant_native_test'),true);
  offTool();offSection();
  assert.equal(ctx.tools.schemas(a).some(row=>row.name==='assistant_native_test'),false);
  await scopeA.dispose();await scopeB.dispose();await ctx.fiber.dispose();
});
