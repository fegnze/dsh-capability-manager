import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '@deepseek-ai/dsh-session';
import { createAssistantRuntime } from '../src/assistants/index.mjs';
import { evidenceProjection, bindingNotice } from '../src/assistants/evidence.mjs';
import { identityOf } from '../src/assistants/schema.mjs';

const deferred = () => Promise.withResolvers();
const manifest = (overrides = {}) => ({ schemaVersion:1,id:'test-assistant',name:'Test',description:'Test assistant',package:{name:'@test/assistant',version:'1.0.0',contentDigest:'a'.repeat(64)},requires:{agentPreset:'cordis'},capabilities:[],...overrides });
function fixture({ records = new Map(), seeds = [], preset = 'standard', started = false, missing = null, flush = true } = {}) {
  const effects = [], events = new Map(), agents = new Map(), definitions = new Map(), guards = [];
  const scope = () => ({ effect(fn) { const off = fn(); effects.push(off); return off; } });
  const owner = scope(), agentEffects = [];
  const session = seeds.length ? Session.create('test-session', seeds, {version:4,id:'test-session',createdAt:1,isSeeded:false}, 0) : Session.create('test-session');
  if (started) { session.append('turn/start',{turn:1}); session.append('turn/end',{turn:1,reason:{kind:'completed'}}); }
  const stateOf = (session, key) => {
    const log = session.snapshotEvents(); // Test-only native replay oracle.
    if (key === 'turnBoundary') {
      let lastTurn = 0, openTurnStartSeq = null;
      for (const event of log) { if(event.type === 'turn/start') {lastTurn=event.data.turn;openTurnStartSeq=event.seq;} if(event.type==='turn/end') openTurnStartSeq=null; }
      return {lastTurn,openTurnStartSeq};
    }
    const def = definitions.get(key);
    if (!def) return;
    return log.reduce((state,event)=>def.apply(state,event),def.init(session.header));
  };
  const scopes = { tools: new Set(), skills: new Set(), sections: new Set() };
  const add = (set, value) => { set.add(value); return () => set.delete(value); };
  const agent = {
    id:session.id, session, status:'idle', inbox:{nextTurn:[],nextStep:[]}, canceled:0,
    ctx:{effect(fn){const off=fn();agentEffects.push(off);return off;},tools:{register:x=>add(scopes.tools,x)},skills:{register:x=>add(scopes.skills,x)},systemPrompt:{section:x=>add(scopes.sections,x)}},
    inject(message){this.inbox.nextStep.push(message);session.append('agent/inbox/spliced',{target:'next-step',start:0,inserted:[message]});},
    cancel(){this.canceled++;}, async whenIdle(){},
    runMaintenance(fn){if(this.status!=='idle'||this.maintenance) throw Error('busy');this.maintenance=true;return Promise.resolve().then(()=>fn(new AbortController().signal)).finally(()=>this.maintenance=false);},
  };
  agents.set(agent.id,agent);
  const controls = { flush, writeFail:false, closed:false, children:[], selected:0, mounted:0, released:0, provider: {name:'spawn',inheritsParentContext:false,capabilities:{agentPreset:true,agentOptions:true,depthLimit:true,outputSchema:true}}, activated:null };
  const table = { get:key=>records.get(key), async put(key,value){if(controls.writeFail)throw Error('disk');records.set(key,structuredClone(value));} };
  const services = {
    agents:{get:id=>agents.get(id),list:()=>[...agents.values()]},
    sessions:{flush:async()=>controls.flush},
    storageDomain:{async open(){return {table:()=>table,async close(){controls.closed=true;}};}},
    sessionProjections:{register(def){definitions.set(def.key,def);return()=>definitions.delete(def.key);},stateOf},
    tools:{guard(fn){guards.push(fn);return()=>guards.splice(guards.indexOf(fn),1);}},
    agentPresets:{composedPreset:()=>preset,resolve:async id=>({id}),select:async(_agent,id)=>{preset=id;controls.selected++;}},
    subagents:{listDescendants:async()=>controls.children,getProvider:()=>controls.provider,resolveMaxDepth:()=>1,startActivation:async spec=>{controls.activated=spec;return{childId:'child',result:Promise.resolve({}),dispose:async()=>{}};}},
  };
  if(missing)delete services[missing];
  const ctx={get:key=>services[key],effect:owner.effect,on(name,fn){const rows=events.get(name)??[];rows.push(fn);events.set(name,rows);return()=>rows.splice(rows.indexOf(fn),1);}};
  const runtime=createAssistantRuntime(ctx);
  const definition={manifest:manifest(),check:async()=>({status:'ready',issues:[]}),mount:async({ctx})=>{
    controls.mounted++;const offs=[ctx.tools.register({name:'assistant_test'}),ctx.skills.register({name:'assistant-test'}),ctx.systemPrompt.section({name:'assistant',text:'x'})];
    return{dispose(){controls.released++;for(const off of offs)off();}};
  }};
  const register = (def=definition)=>runtime.register(scope(),def);
  const preview = ()=>runtime.previewBind({sessionId:agent.id,id:definition.manifest.id});
  const bind = async()=>{const p=await preview();return runtime.bind({sessionId:agent.id,id:definition.manifest.id,revision:p.revision,confirm:true});};
  const fire = async(name,payload,base=async()=>({kind:'enter',messages:[]}))=>{
    const rows=events.get(name)??[];
    if(name==='agent/created'){for(const fn of rows)await fn(payload);return;}
    let run=base;for(const fn of [...rows].reverse()){const next=run;run=()=>fn(payload,next);}return run();
  };
  return {runtime,definition,register,preview,bind,agent,records,controls,services,fire,guards,agentEffects,scopes,session,effects};
}

async function prepared(options) {const f=fixture(options);await f.runtime.ready;f.unregister=f.register();return f;}

test('strict declarations and duplicate identity; owner disposer revokes registration',async()=>{
  const f=await prepared();
  assert.throws(()=>f.register(),{code:'DUPLICATE_ASSISTANT'});
  const bad={...f.definition,manifest:manifest({id:'other',surprise:true})};assert.throws(()=>f.register(bad),{code:'INVALID_DECLARATION'});
  let invoked=false;const accessor={...f.definition,manifest:manifest({id:'other'})};Object.defineProperty(accessor.manifest,'name',{enumerable:true,get(){invoked=true;return 'x';}});
  assert.throws(()=>f.register(accessor),{code:'INVALID_DECLARATION'});assert.equal(invoked,false);
  await f.unregister();assert.equal((await f.runtime.list()).assistants.length,0);await f.runtime.dispose();
});
test('blank binding selects native preset, persists marker, mounts only scoped contributions',async()=>{
  const f=await prepared();const p=await f.preview();assert.equal(p.canBind,true);
  const result=await f.runtime.bind({sessionId:f.agent.id,id:f.definition.manifest.id,revision:p.revision,confirm:true});
  assert.equal(result.phase,'bound');assert.equal(result.canSubmit,true);assert.equal(f.controls.selected,1);assert.equal(f.controls.mounted,1);
  assert.equal(f.agent.inbox.nextTurn.length,0);assert.equal(f.scopes.tools.size,1);assert.equal(f.scopes.skills.size,1);
  const evidence=f.services.sessionProjections.stateOf(f.session,'dshAssistantBinding');assert.equal(evidence.marker.identity.packageVersion,'1.0.0');
  assert.equal((await f.bind()).phase,'bound');assert.equal(f.controls.mounted,1);
  await f.unregister();assert.equal(f.runtime.readBinding(f.agent.id).phase,'blocked');assert.equal(f.scopes.tools.size,0);assert.equal(f.controls.released,1);
  await f.unregister();assert.equal(f.controls.released,1);await f.runtime.dispose();
});
test('started mismatch persists blocked selection, rejects admission and another identity',async()=>{
  const f=await prepared({started:true});const p=await f.preview();assert.equal(p.canBind,false);
  const result=await f.runtime.bind({sessionId:f.agent.id,id:'test-assistant',revision:p.revision,confirm:true});
  assert.equal(result.phase,'blocked');assert.equal(result.reason,'PRESET_MISMATCH');assert.match(result.continuationPrompt,/新建会话/);assert.equal(f.controls.selected,0);assert.equal(f.controls.mounted,0);
  assert.equal((await f.fire('agent/pre-step',{agent:f.agent})).kind,'reject');
  await assert.rejects(f.fire('agent/request',{agent:f.agent},async()=>({provider:'x'})),{code:'PRESET_MISMATCH'});
  assert.match(f.guards[0]({agent:f.agent}),/blocked/);
  const another={...f.definition,manifest:manifest({id:'another'})};f.register(another);const other=await f.runtime.previewBind({sessionId:f.agent.id,id:'another'});
  await assert.rejects(f.runtime.bind({sessionId:f.agent.id,id:'another',revision:other.revision,confirm:true}),{code:'BINDING_LOCKED'});await f.runtime.dispose();
});
test('compatible already-started idle session can bind without selecting preset',async()=>{
  const f=await prepared({started:true,preset:'cordis'});assert.equal((await f.bind()).phase,'bound');assert.equal(f.controls.selected,0);await f.runtime.dispose();
});
test('queued work and descendant diagnostics refuse activation; no wake or submit',async()=>{
  const f=await prepared();f.agent.inbox.nextTurn.push({source:{kind:'user'}});assert.equal((await f.preview()).canBind,false);
  await assert.rejects(f.bind(),{code:'SESSION_BUSY'});assert.equal(f.controls.mounted,0);
  f.agent.inbox.nextTurn=[];f.controls.children=[{kind:'diagnostic',reason:'unavailable'}];assert.equal((await f.preview()).canBind,false);await f.runtime.dispose();
});
test('async mount racing input is disposed and kept blocked',async()=>{
  const f=fixture();await f.runtime.ready;const gate=deferred(),entered=deferred();
  f.definition.mount=async()=>{entered.resolve();await gate.promise;return{dispose(){f.controls.released++;}};};f.register();
  const pending=f.bind();await entered.promise;f.agent.inbox.nextTurn.push({source:{kind:'user'}});gate.resolve();
  assert.equal((await pending).phase,'blocked');assert.equal(f.controls.released,1);await f.runtime.dispose();
});
test('package revocation racing mount rejects stale activation and cleans once',async()=>{
  const f=fixture();await f.runtime.ready;const gate=deferred(),entered=deferred();
  f.definition.mount=async()=>{entered.resolve();await gate.promise;return{dispose(){f.controls.released++;}};};const unregister=f.register();
  const pending=f.bind();await entered.promise;const removed=unregister();gate.resolve();await removed;
  assert.equal((await pending).phase,'blocked');assert.equal(f.controls.released,1);await f.runtime.dispose();
});
test('storage and durability checkpoint failures never activate',async()=>{
  const f=await prepared({flush:false});assert.equal((await f.bind()).phase,'blocked');assert.equal(f.controls.mounted,0);await f.runtime.dispose();
  const g=await prepared();g.controls.writeFail=true;assert.equal((await g.bind()).phase,'blocked');assert.equal(g.controls.mounted,0);await g.runtime.dispose();
});
test('restores exact version before admission; missing sidecar or changed package blocks',async()=>{
  const f=await prepared();await f.bind();const seed=f.session.snapshotEvents(),records=new Map(f.records);await f.runtime.dispose();
  // Copy captured before unload, which intentionally stores a tombstone.
  const g=await prepared({records:new Map(records),seeds:seed,preset:'cordis'});await g.fire('agent/created',{agent:g.agent,source:'resume'});
  assert.equal(g.runtime.readBinding(g.agent.id).phase,'bound');assert.equal(g.controls.mounted,1);await g.runtime.dispose();
  const h=await prepared({seeds:seed,preset:'cordis'});assert.equal(h.runtime.readBinding(h.agent.id).reason,'BINDING_MISSING');await h.runtime.dispose();
  const k=fixture({records:new Map(records),seeds:seed,preset:'cordis'});await k.runtime.ready;k.definition.manifest.package.version='2.0.0';k.register();
  await k.fire('agent/created',{agent:k.agent,source:'resume'});assert.equal(k.runtime.readBinding(k.agent.id).reason,'PACKAGE_CHANGED');assert.equal(k.controls.mounted,0);await k.runtime.dispose();
});
test('guards are active before initialization and remain closed without storage',async()=>{
  const f=fixture({missing:'storageDomain'});assert.equal((await f.fire('agent/pre-step',{agent:f.agent})).kind,'reject');await f.runtime.ready;
  assert.equal(f.runtime.readBinding(f.agent.id).phase,'blocked');assert.equal((await f.runtime.list()).available,false);await f.runtime.dispose();
});
test('evidence projection survives native session replay and ignores inherited foreign identity',()=>{
  const s=Session.create('original');const record={sessionId:s.id,selectionId:'choice',identity:identityOf(manifest())};s.append('agent/inbox/spliced',{target:'next-step',start:0,inserted:[bindingNotice(record)]});
  const restored=Session.create(s.id,s.snapshotEvents(),s.header,0);const fold=session=>session.snapshotEvents().reduce((state,event)=>evidenceProjection.apply(state,event),evidenceProjection.init(session.header));
  assert.equal(fold(restored).marker.identity.assistantId,'test-assistant');
  const child=Session.create('child',s.snapshotEvents(),{...s.header,id:'child',isSeeded:true,parentSession:s.id},s.seq);assert.equal(fold(child).marker,null);
  const second={...record,identity:{...record.identity,packageVersion:'2.0.0'}};s.append('agent/inbox/spliced',{target:'next-step',start:1,inserted:[bindingNotice(second)]});assert.equal(fold(s).conflict,true);
});
test('ordinary base teardown preserves successful binding and leaves unbound sessions alone',async()=>{
  const f=await prepared();await f.bind();const before=structuredClone(f.records.get(f.agent.id));await f.runtime.dispose();
  assert.deepEqual(f.records.get(f.agent.id),before);assert.equal(f.controls.released,1);
  const g=await prepared();await g.runtime.dispose();assert.equal(g.agent.canceled,0);
});
test('ready warnings are nonblocking; missing prerequisites remain selectable as blocked',async()=>{
  const f=fixture();await f.runtime.ready;f.definition.check=async()=>({status:'ready',issues:[{code:'OPTIONAL_GH_MISSING',message:'Publishing requires gh'}]});f.register();
  const p=await f.preview();assert.equal(p.canSelect,true);assert.equal(p.canBind,true);assert.equal(p.issues.length,1);assert.equal((await f.bind()).phase,'bound');await f.runtime.dispose();
  const g=fixture();await g.runtime.ready;g.definition.check=async()=>({status:'configuration-required',issues:[{code:'CONFIG_REQUIRED',message:'Set config path'}]});g.register();
  const q=await g.preview();assert.equal(q.canSelect,true);assert.equal(q.canBind,false);const bound=await g.bind();assert.equal(bound.phase,'blocked');assert.equal(bound.reason,'CONFIG_REQUIRED');await g.runtime.dispose();
});
test('pre-step prerequisite drift closes request and tool admission before the next model call',async()=>{
  const f=fixture();let ready=true;await f.runtime.ready;f.definition.check=async()=>ready?{status:'ready',issues:[]}:{status:'unavailable',issues:[{code:'CONFIG_DRIFT',message:'Configuration changed'}]};f.register();await f.bind();ready=false;
  assert.equal((await f.fire('agent/pre-step',{agent:f.agent})).kind,'reject');assert.match(f.guards[0]({agent:f.agent}),/CONFIG_DRIFT/);
  await assert.rejects(f.fire('agent/request',{agent:f.agent}),{code:'CONFIG_DRIFT'});await f.runtime.dispose();
});
test('preset mutation and package removal between request hooks cannot pass stale admission',async()=>{
  const f=await prepared();await f.bind();
  await assert.rejects(f.fire('agent/request',{agent:f.agent},async()=>{await f.unregister();return{};}),{code:'PACKAGE_UNAVAILABLE'});assert.equal(f.controls.released,1);await f.runtime.dispose();
});
test('same-identity retry repairs missing sidecar only when exact native evidence remains',async()=>{
  const f=await prepared();await f.bind();f.records.delete(f.agent.id);assert.equal(f.runtime.readBinding(f.agent.id).reason,'BINDING_MISSING');
  assert.equal((await f.bind()).phase,'bound');
  const current=f.records.get(f.agent.id);f.records.set(f.agent.id,{...current,selectionId:'other-choice'});const p=await f.preview();assert.equal(p.canSelect,false);
  await assert.rejects(f.runtime.bind({sessionId:f.agent.id,id:'test-assistant',revision:p.revision,confirm:true}),{code:'EVIDENCE_MISMATCH'});await f.runtime.dispose();
});
test('concurrent bind uses one maintenance reservation and rejects duplicate in-flight activation',async()=>{
  const f=fixture();await f.runtime.ready;const gate=deferred(),entered=deferred();f.definition.mount=async()=>{entered.resolve();await gate.promise;return{dispose(){f.controls.released++;}};};f.register();
  const p=await f.preview(),q=await f.preview();const pending=f.runtime.bind({sessionId:f.agent.id,id:'test-assistant',revision:p.revision,confirm:true});await entered.promise;
  await assert.rejects(f.runtime.bind({sessionId:f.agent.id,id:'test-assistant',revision:q.revision,confirm:true}),{code:'BINDING_BUSY'});gate.resolve();assert.equal((await pending).phase,'bound');await f.runtime.dispose();
});
test('late package restore owns maintenance and rejects concurrent user input',async()=>{
  const f=await prepared();await f.bind();const seeds=f.session.snapshotEvents(),records=new Map(f.records);await f.runtime.dispose();
  const g=fixture({seeds,records,preset:'cordis'});await g.runtime.ready;const gate=deferred(),entered=deferred();g.definition.mount=async()=>{entered.resolve();await gate.promise;return{dispose(){g.controls.released++;}};};g.register();
  await entered.promise;assert.equal(g.agent.maintenance,true);g.agent.inbox.nextTurn.push({source:{kind:'user'}});gate.resolve();
  await g.fire('agent/created',{agent:g.agent,source:'resume'});assert.equal(g.runtime.readBinding(g.agent.id).phase,'blocked');assert.equal(g.controls.released,1);await g.runtime.dispose();
});
test('bound tool guard rejects exact self bundle removal but leaves other native operations alone',async()=>{
  const f=await prepared();await f.bind();const guard=f.guards[0];
  for(const target of ['@test/assistant','@fegnze/dsh-capability-manager']) {
    assert.match(guard({agent:f.agent,name:'plugin_manager',arguments:{action:'remove_bundle',target}}),/native Plugins/);
    assert.match(guard({agent:f.agent,name:'plugin_manager',arguments:{action:'set_bundle',target,enabled:false}}),/native Plugins/);
    assert.equal(guard({agent:f.agent,name:'plugin_manager',arguments:{action:'set_bundle',target,enabled:true}}),undefined);
  }
  assert.equal(guard({agent:f.agent,name:'plugin_manager',arguments:{action:'remove_bundle',target:'@other/plugin'}}),undefined);
  assert.equal(guard({name:'plugin_manager',arguments:{action:'remove_bundle',target:'@test/assistant'}}),undefined);
  await f.runtime.dispose();
});
test('unexpected self unload revokes admission without awaiting its own active tool turn',async()=>{
  const f=await prepared();await f.bind();const idle=deferred();f.agent.whenIdle=()=>idle.promise;
  f.services.agents.currentInitiator=()=>f.agent;f.services.agents.withoutInitiator=fn=>fn();
  await f.unregister();assert.equal(f.runtime.readBinding(f.agent.id).canSubmit,false);assert.equal(f.controls.released,0);
  idle.resolve();await f.agent.whenIdle();
  // The cleanup is already scheduled on the same idle promise; run its continuation.
  await Promise.resolve();await Promise.resolve();assert.equal(f.controls.released,1);await f.runtime.dispose();
});
test('repeated created notification does not duplicate a completed restore mount',async()=>{
  const f=await prepared();await f.bind();await f.fire('agent/created',{agent:f.agent,source:'resume'});
  assert.equal(f.controls.mounted,1);assert.equal(f.controls.released,0);await f.runtime.dispose();
});
test('delegation rejects unavailable services, unsupported structured options and canceled startup',async()=>{
  const f=await prepared();await f.bind();const request={agent:f.agent,provider:'spawn',label:'Review',prompt:'Review',context:'clean'};
  f.controls.provider.capabilities.outputSchema=false;
  await assert.rejects(f.runtime.delegate({...request,outputSchema:{type:'object'}}),{code:'UNSUPPORTED_OUTPUT_SCHEMA'});
  f.controls.provider.capabilities.depthLimit=false;
  await assert.rejects(f.runtime.delegate({...request,depthLimit:2}),{code:'UNSUPPORTED_DEPTH_LIMIT'});
  f.controls.provider.capabilities.depthLimit=true;
  const abort=new AbortController();abort.abort();await assert.rejects(f.runtime.delegate({...request,signal:abort.signal}),{name:'AbortError'});
  f.controls.provider=null;await assert.rejects(f.runtime.delegate(request),{code:'DELEGATION_PROVIDER_UNAVAILABLE'});
  assert.equal(f.controls.activated,null);await f.runtime.dispose();
});
test('delegation checks context/capabilities and preserves native activation handle',async()=>{
  const f=await prepared({preset:'cordis'});await f.bind();
  const handle=await f.runtime.delegate({agent:f.agent,provider:'spawn',label:'Review',prompt:'Review one file',context:'clean',agentPreset:'cordis'});
  assert.equal(handle.childId,'child');assert.equal(f.controls.activated.request.parent,f.agent);assert.equal(f.controls.activated.request.maxDepth,1);
  await assert.rejects(f.runtime.delegate({agent:f.agent,provider:'spawn',label:'Review',prompt:'x',context:'inherited'}),{code:'DELEGATION_CONTEXT_MISMATCH'});
  f.controls.provider.capabilities.agentPreset=false;
  await assert.rejects(f.runtime.delegate({agent:f.agent,provider:'spawn',label:'Review',prompt:'x',context:'clean',agentPreset:'cordis'}),{code:'UNSUPPORTED_AGENT_PRESET'});await f.runtime.dispose();
});
