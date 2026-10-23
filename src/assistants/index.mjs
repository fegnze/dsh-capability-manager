import { randomUUID } from 'node:crypto';
import { AssistantError, fail, domainSpec, bindingSchema, parseManifest, identityOf, sameIdentity, readinessSchema, jsonValue, issue, continuation, sessionKey, onceAsync } from './schema.mjs';
import { EVIDENCE_KEY, evidenceProjection, bindingNotice, isOwnNotice } from './evidence.mjs';
import { delegateNative } from './delegation.mjs';
export { AssistantError } from './schema.mjs';

const getService = (ctx, name) => { try { return ctx.get(name); } catch { return undefined; } };
const unavailable = code => ({ status: 'unavailable', issues: [issue(code)] });
const combined = (...signals) => AbortSignal.any(signals.filter(Boolean));

export function createAssistantRuntime(ctx) {
  const registry = new Map(), states = new Map(), previews = new Map(), listeners = [], tasks = new Set();
  const closing = new AbortController();
  let domain, table, initialized = false, initError = 'RUNTIME_INITIALIZING', disposed = false;
  let serial = 0;
  const service = name => getService(ctx, name);
  const track = promise => { tasks.add(promise); promise.finally(() => tasks.delete(promise)).catch(() => {}); return promise; };
  const live = id => service('agents')?.get(id);
  const currentPreset = agent => service('agentPresets')?.composedPreset(agent.ctx) ?? null;
  const evidence = agent => {
    const value = service('sessionProjections')?.stateOf(agent.session, EVIDENCE_KEY);
    if (!value || value.sessionId !== agent.id) fail('EVIDENCE_UNAVAILABLE', 503);
    return value;
  };
  const recordFor = id => {
    if (!table) return null;
    const value = table.get(id);
    if (value === undefined) return null;
    const parsed = bindingSchema.safeParse(value);
    if (!parsed.success || parsed.data.sessionId !== id) fail('BINDING_CORRUPT', 503);
    return parsed.data;
  };
  const stateFor = agent => {
    let state = states.get(agent.id);
    if (state?.agent !== agent) {
      state = { agent, mounted: null, generation: 0, busy: false, reason: null, checked: false, abort: null };
      states.set(agent.id, state);
      agent.ctx.effect(() => () => detach(state));
    }
    return state;
  };
  const assertLive = (state, generation, entry, signal) => {
    signal?.throwIfAborted();
    if (disposed || live(state.agent.id) !== state.agent || states.get(state.agent.id) !== state || state.generation !== generation) fail('ACTIVATION_SUPERSEDED', 409);
    if (entry && (!entry.active || registry.get(entry.manifest.id) !== entry)) fail('PACKAGE_UNAVAILABLE', 409);
  };
  const noQueued = agent => {
    if (!Array.isArray(agent.inbox?.nextTurn) || !Array.isArray(agent.inbox?.nextStep)) fail('INBOX_UNAVAILABLE', 503);
    return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].every(message => isOwnNotice(message, agent.id));
  };
  async function safeIdle(agent, signal) {
    if (agent.status !== 'idle' || !noQueued(agent)) fail('SESSION_BUSY', 409);
    const subagents = service('subagents');
    if (subagents) {
      let rows;
      try { rows = await subagents.listDescendants(agent.id, signal); } catch { fail('DESCENDANTS_UNAVAILABLE', 503); }
      if (rows.some(row => row.kind === 'diagnostic')) fail('DESCENDANTS_UNAVAILABLE', 503);
      if (rows.some(row => row.activity === 'running')) fail('DESCENDANTS_BUSY', 409);
    }
    if (live(agent.id) !== agent || agent.status !== 'idle' || !noQueued(agent)) fail('SESSION_BUSY', 409);
  }
  async function readiness(entry, agent, signal) {
    if (!entry?.active) return unavailable('PACKAGE_UNAVAILABLE');
    const generation = entry.generation;
    try {
      const value = readinessSchema.safeParse(jsonValue(await entry.definition.check({ ...(agent ? { agent } : {}), signal: combined(signal, entry.abort.signal, closing.signal) })));
      if (!entry.active || generation !== entry.generation) return unavailable('PACKAGE_UNAVAILABLE');
      return value.success ? value.data : unavailable('INVALID_READINESS');
    } catch { return unavailable(signal?.aborted ? 'CHECK_CANCELED' : 'CHECK_FAILED'); }
  }
  async function presetCheck(identity, agent) {
    if (!identity.requiredPreset) return [];
    const presets = service('agentPresets');
    if (!presets) return [issue('PRESET_SERVICE_UNAVAILABLE')];
    try {
      const result = await presets.resolve(identity.requiredPreset);
      if (result.broken) return [issue('PRESET_UNAVAILABLE')];
      if (agent && currentPreset(agent) !== identity.requiredPreset) return [issue('PRESET_MISMATCH')];
      return [];
    } catch { return [issue('PRESET_UNAVAILABLE')]; }
  }
  function readBinding(sessionOrId) {
    const id = sessionKey(typeof sessionOrId === 'string' ? sessionOrId : sessionOrId?.id);
    const agent = live(id);
    let record = null, marker = null, reason = disposed ? 'RUNTIME_UNAVAILABLE' : initialized ? null : initError;
    try {
      record = recordFor(id);
      if (agent && initialized) {
        const proof = evidence(agent);
        marker = proof.marker;
        if (proof.conflict) reason = 'EVIDENCE_CONFLICT';
        else if (!record && marker) reason = 'BINDING_MISSING';
        else if (record && (!marker || marker.selectionId !== record.selectionId || !sameIdentity(marker.identity, record.identity))) reason = 'EVIDENCE_MISMATCH';
      } else if (!agent) reason = reason ?? 'SESSION_NOT_LIVE';
    } catch (error) { reason = error.code ?? 'BINDING_CORRUPT'; }
    const state = agent ? states.get(id) : null;
    const identity = record?.identity ?? marker?.identity ?? state?.intent?.identity ?? null;
    if (!reason && state?.reason) reason = state.reason;
    if (!reason && record) {
      const entry = registry.get(identity.assistantId);
      if (!entry?.active) reason = 'PACKAGE_UNAVAILABLE';
      else if (!sameIdentity(identity, identityOf(entry.manifest))) reason = 'PACKAGE_CHANGED';
      else if (identity.requiredPreset && currentPreset(agent) !== identity.requiredPreset) reason = 'PRESET_MISMATCH';
      else if (record.phase === 'blocked') reason = record.reason ?? 'BINDING_BLOCKED';
      else if (state?.reason) reason = state.reason;
      else if (!state?.mounted || !state.checked) reason = state?.busy ? null : 'RESTORE_REQUIRED';
    }
    const phase = reason ? 'blocked' : state?.busy || record?.phase === 'preparing' ? 'preparing' : record ? 'bound' : 'unbound';
    return { sessionId: id, phase, identity, revision: record?.revision ?? 0, reason, continuationPrompt: continuation(identity, agent?.session.header.cwd), canSubmit: phase === 'bound' || phase === 'unbound' };
  }
  function assertAdmission(agent) {
    const view = readBinding(agent.id);
    if (!view.canSubmit) fail(view.reason ?? 'BINDING_PREPARING', 409);
    return view;
  }
  // Guards are installed before storage initialization. They do not pretend to pause an inbox.
  listeners.push(ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const view = readBinding(agent.id);
    if (!view.canSubmit) return { kind: 'reject' };
    if (view.identity) {
      const entry = registry.get(view.identity.assistantId);
      const check = await readiness(entry, agent, signal);
      const presetIssues = await presetCheck(view.identity, agent);
      if (check.status !== 'ready' || presetIssues.length) {
        const state = states.get(agent.id);
        if (state) state.reason = presetIssues[0]?.code ?? check.issues[0]?.code ?? 'PREREQUISITES_UNAVAILABLE';
        return { kind: 'reject' };
      }
    }
    const decision = await next();
    return readBinding(agent.id).canSubmit ? decision : { kind: 'reject' };
  }));
  listeners.push(ctx.on('agent/request', async ({ agent }, next) => {
    assertAdmission(agent);
    const config = await next();
    assertAdmission(agent);
    return config;
  }));
  const tools = service('tools');
  if (tools) listeners.push(tools.guard(input => {
    if (!input.agent) return;
    const view = readBinding(input.agent.id);
    if (view.identity && input.name === 'plugin_manager') {
      const args = input.arguments;
      const ownTargets = new Set([view.identity.packageName, '@fegnze/dsh-capability-manager']);
      if (args && ownTargets.has(args.target) && (args.action === 'remove_bundle' || args.action === 'set_bundle' && args.enabled === false)) {
        return 'Remove or disable this assistant or its base from the native Plugins page, not from its bound Agent.';
      }
    }
    return view.canSubmit ? undefined : `Assistant binding blocked: ${view.reason ?? view.phase}`;
  }));
  listeners.push(ctx.on('agent/created', async ({ agent, signal }) => {
    const state = stateFor(agent);
    await runtime.ready;
    if (initialized && !disposed) await restore(state, signal, true);
    return undefined;
  }));

  async function detach(state) {
    state.generation++;
    state.abort?.abort();
    if (states.get(state.agent.id) === state) states.delete(state.agent.id);
    await releaseMount(state);
  }
  async function releaseMount(state) {
    const mounted = state.mounted;
    state.mounted = null;
    state.checked = false;
    if (mounted) await mounted.dispose();
  }
  async function blocked(state, record, code) {
    state.intent = record;
    state.reason = code;
    state.checked = false;
    await releaseMount(state);
    if (table && record) {
      try { await table.put(record.sessionId, { ...record, phase: 'blocked', reason: code, revision: record.revision + 1 }); }
      catch { state.reason = 'STORAGE_WRITE_FAILED'; }
    }
  }
  async function mount(state, entry, record, signal, generation) {
    const pending = (async () => {
      const mounted = await entry.definition.mount({ ctx: state.agent.ctx, agent: state.agent, signal, manifest: entry.manifest });
      if (!mounted || typeof mounted.dispose !== 'function') fail('INVALID_MOUNT');
      const handle = { dispose: onceAsync(() => mounted.dispose()) };
      try { assertLive(state, generation, entry, signal); }
      catch (error) { await handle.dispose(); throw error; }
      state.mounted = handle;
      return handle;
    })();
    entry.mounts.add(pending);
    try { return await pending; }
    finally { entry.mounts.delete(pending); }
  }
  function restore(state, signal, duringCreation = false) {
    if (state.restoring) return state.restoring;
    let promise;
    // agent/created already owns the native initialization boundary. Late package
    // registration instead reserves real idle through the official maintenance API.
    if (duringCreation) promise = restoreNow(state, signal, true);
    else {
      try {
        if (typeof state.agent.runMaintenance !== 'function') fail('SAFE_IDLE_UNAVAILABLE');
        promise = state.agent.runMaintenance(token => restoreNow(state, combined(signal, token), false));
      } catch (error) {
        state.reason = error.code ?? 'SESSION_BUSY';
        promise = Promise.resolve();
      }
    }
    state.restoring = promise;
    promise.finally(() => { if (state.restoring === promise) state.restoring = null; }).catch(() => {});
    return promise;
  }
  async function restoreNow(state, signal, duringCreation) {
    if (state.busy || disposed) return;
    let record;
    try {
      record = recordFor(state.agent.id);
      const proof = evidence(state.agent);
      if (proof.conflict) fail('EVIDENCE_CONFLICT');
      if (!record) {
        state.checked = !proof.marker;
        state.reason = proof.marker ? 'BINDING_MISSING' : null;
        return;
      }
      if (!proof.marker || proof.marker.selectionId !== record.selectionId || !sameIdentity(proof.marker.identity, record.identity)) fail('EVIDENCE_MISMATCH');
      // An interrupted binding or previously blocked selection requires explicit exact retry.
      if (record.phase !== 'bound') { state.reason = record.reason ?? 'RECOVERY_REQUIRED'; return; }
      if (state.mounted && state.checked && readBinding(state.agent.id).canSubmit) return;
      if (state.agent.status !== 'idle') fail('SESSION_BUSY');
      const entry = registry.get(record.identity.assistantId);
      if (!entry?.active) fail('PACKAGE_UNAVAILABLE');
      if (!sameIdentity(record.identity, identityOf(entry.manifest))) fail('PACKAGE_CHANGED');
      state.busy = true;
      state.reason = null;
      const generation = ++state.generation;
      state.abort = new AbortController();
      const token = combined(signal, state.abort.signal, entry.abort.signal, closing.signal);
      const recheck = async () => {
        assertLive(state, generation, entry, token);
        if (!duringCreation) await safeIdle(state.agent, token);
        assertLive(state, generation, entry, token);
      };
      await recheck();
      await releaseMount(state);
      await recheck();
      const issues = await presetCheck(record.identity, state.agent);
      await recheck();
      if (issues.length) fail(issues[0].code);
      const check = await readiness(entry, state.agent, token);
      await recheck();
      if (check.status !== 'ready') fail(check.issues[0]?.code ?? 'PREREQUISITES_UNAVAILABLE');
      await mount(state, entry, record, token, generation);
      await recheck();
      state.checked = true;
    } catch (error) {
      // Startup package order must not turn a valid persisted binding into a
      // permanent tombstone. Keep the durable intent and expose a blocked live view.
      state.reason = error.code ?? 'RESTORE_FAILED';
      state.checked = false;
      await releaseMount(state);
    }
    finally { state.busy = false; }
  }
  function register(ownerCtx, definition) {
    if (disposed || !ownerCtx || typeof ownerCtx.effect !== 'function') fail('REGISTRY_UNAVAILABLE', 503);
    if (!definition || typeof definition.check !== 'function' || typeof definition.mount !== 'function') fail('INVALID_DECLARATION');
    const manifest = parseManifest(definition.manifest);
    if (registry.has(manifest.id)) fail('DUPLICATE_ASSISTANT', 409);
    const entry = { manifest, definition: { check: definition.check, mount: definition.mount }, active: true, generation: ++serial, abort: new AbortController(), mounts: new Set() };
    registry.set(manifest.id, entry);
    const unregister = onceAsync(() => {
      entry.active = false;
      entry.generation++;
      entry.abort.abort();
      if (registry.get(manifest.id) === entry) registry.delete(manifest.id);
      const affected = [...states.values()].filter(state => {
        try { return recordFor(state.agent.id)?.identity.assistantId === manifest.id; } catch { return true; }
      });
      for (const state of affected) {
        state.generation++;
        state.reason = 'PACKAGE_UNAVAILABLE';
        state.abort?.abort();
        state.agent.cancel({ kind: 'hook', reason: 'Assistant package unavailable' }, { keepInbox: true });
      }
      const initiator = service('agents')?.currentInitiator?.();
      const cleanup = async state => {
        await Promise.allSettled([...entry.mounts]);
        await state.agent.whenIdle();
        await releaseMount(state);
        // The immutable selection is the durable tombstone. Do not rewrite a
        // successful binding to blocked merely because the App is shutting down.
        state.reason = 'PACKAGE_UNAVAILABLE';
      };
      const waits = [];
      for (const state of affected) {
        if (state.agent === initiator) {
          // Never make a package unload wait for the very Agent tool call that
          // initiated it. Admission was revoked above; drain once that turn ends.
          const deferred = () => cleanup(state).catch(() => { state.reason = 'PACKAGE_CLEANUP_FAILED'; });
          if (service('agents')?.withoutInitiator) service('agents').withoutInitiator(deferred);
          else deferred();
        } else waits.push(cleanup(state));
      }
      return track(Promise.allSettled(waits).then(results => { if (results.some(row => row.status === 'rejected')) fail('PACKAGE_CLEANUP_FAILED', 500); }));
    });
    entry.unregister = unregister;
    ownerCtx.effect(() => unregister);
    // Late provider activation can restore a previously persisted bound row; explicit blocked rows stay blocked.
    track(runtime.ready.then(async () => {
      if (!entry.active || !initialized) return;
      for (const agent of service('agents')?.list() ?? []) {
        const record = recordFor(agent.id);
        if (record?.identity.assistantId === manifest.id && record.phase === 'bound') await restore(stateFor(agent));
      }
    })).catch(() => {});
    return unregister;
  }
  async function list({ sessionId, signal } = {}) {
    await runtime.ready;
    const agent = sessionId ? live(sessionKey(sessionId)) : undefined;
    const assistants = await Promise.all([...registry.values()].map(async entry => ({
      id: entry.manifest.id, name: entry.manifest.name, description: entry.manifest.description, package: entry.manifest.package,
      requiredPreset: entry.manifest.requires?.agentPreset ?? null, capabilities: entry.manifest.capabilities,
      readiness: initialized ? await readiness(entry, agent, signal) : unavailable(initError),
    })));
    return { assistants, binding: sessionId ? readBinding(sessionId) : null, available: initialized && !disposed, issues: initialized && !disposed ? [] : [issue(initError)] };
  }
  async function detail({ id, sessionId, signal } = {}) {
    await runtime.ready;
    const entry = registry.get(id);
    if (!entry) fail('ASSISTANT_NOT_FOUND', 404);
    return { manifest: entry.manifest, readiness: initialized ? await readiness(entry, sessionId ? live(sessionKey(sessionId)) : undefined, signal) : unavailable(initError), binding: sessionId ? readBinding(sessionId) : null, available: initialized && entry.active && !disposed };
  }
  async function previewBind({ sessionId, id, signal } = {}) {
    await runtime.ready;
    if (!initialized || disposed) fail(initError, 503);
    const agent = live(sessionKey(sessionId)), entry = registry.get(id);
    if (!agent) fail('SESSION_NOT_LIVE', 404);
    if (!entry?.active) fail('ASSISTANT_NOT_FOUND', 404);
    const identity = identityOf(entry.manifest), binding = readBinding(sessionId), issues = [];
    if (binding.identity && !sameIdentity(binding.identity, identity)) issues.push(issue('BINDING_LOCKED'));
    try {
      const proof = evidence(agent), record = recordFor(sessionId);
      if (proof.conflict) fail('EVIDENCE_CONFLICT');
      if (record && (!proof.marker || proof.marker.selectionId !== record.selectionId || !sameIdentity(proof.marker.identity, record.identity))) fail('EVIDENCE_MISMATCH');
      await safeIdle(agent, signal);
    } catch (error) { issues.push(issue(error.code ?? 'SESSION_BUSY')); }
    const canSelect = issues.length === 0;
    const check = await readiness(entry, agent, signal);
    const blockingReadiness = check.status !== 'ready';
    const warningCount = blockingReadiness ? 0 : check.issues.length;
    issues.push(...check.issues);
    if (blockingReadiness && !check.issues.length) issues.push(issue('PREREQUISITES_UNAVAILABLE'));
    const presetIssues = await presetCheck(identity, agent);
    const boundary = service('sessionProjections')?.stateOf(agent.session, 'turnBoundary');
    if (!boundary) issues.push(issue('TURN_BOUNDARY_UNAVAILABLE'));
    issues.push(...presetIssues.filter(row => row.code !== 'PRESET_MISMATCH' || !boundary || boundary.lastTurn > 0 || boundary.openTurnStartSeq !== null));
    const revision = randomUUID();
    if (previews.size >= 200) previews.delete(previews.keys().next().value);
    previews.set(revision, { agent, entry, generation: entry.generation, identity, recordRevision: binding.revision, expires: Date.now() + 120000 });
    return { sessionId, id, identity, revision, canSelect, canBind: issues.length === warningCount, issues, currentPreset: currentPreset(agent), requiredPreset: identity.requiredPreset, continuationPrompt: continuation(identity, agent?.session.header.cwd), binding };
  }
  async function bind({ sessionId, id, revision, confirm, signal } = {}) {
    await runtime.ready;
    if (confirm !== true) fail('CONFIRM_REQUIRED');
    if (!initialized || disposed) fail(initError, 503);
    sessionKey(sessionId);
    const preview = previews.get(revision);
    previews.delete(revision);
    if (!preview || preview.expires < Date.now() || preview.agent.id !== sessionId || preview.entry.manifest.id !== id) fail('STALE_PREVIEW', 409);
    const agent = live(sessionId), entry = registry.get(id);
    if (agent !== preview.agent || entry !== preview.entry || !entry.active || entry.generation !== preview.generation) fail('STALE_PREVIEW', 409);
    const state = stateFor(agent);
    if (state.busy || state.restoring) fail('BINDING_BUSY', 409);
    const existing = recordFor(sessionId), proof = evidence(agent);
    if (proof.conflict) fail('EVIDENCE_CONFLICT', 409);
    if (existing && (!proof.marker || proof.marker.selectionId !== existing.selectionId || !sameIdentity(proof.marker.identity, existing.identity))) fail('EVIDENCE_MISMATCH', 409);
    const previousIdentity = existing?.identity ?? proof.marker?.identity ?? state.intent?.identity;
    if (previousIdentity && !sameIdentity(previousIdentity, preview.identity)) fail('BINDING_LOCKED', 409);
    if ((existing?.revision ?? 0) !== preview.recordRevision) fail('STALE_PREVIEW', 409);
    if (existing?.phase === 'bound' && state.mounted && readBinding(sessionId).canSubmit) return readBinding(sessionId);
    if (typeof agent.runMaintenance !== 'function') fail('SAFE_IDLE_UNAVAILABLE', 503);
    state.busy = true;
    state.reason = null;
    const generation = ++state.generation;
    state.abort = new AbortController();
    let record = existing ?? { schemaVersion: 1, sessionId, selectionId: proof.marker?.selectionId ?? randomUUID(), identity: preview.identity, revision: 1, phase: 'preparing', reason: null, boundAt: Date.now() };
    let selectionAttempted = false;
    try {
      return await agent.runMaintenance(async maintenanceSignal => {
        const token = combined(signal, maintenanceSignal, state.abort.signal, entry.abort.signal, closing.signal);
        const recheck = async () => { assertLive(state, generation, entry, token); await safeIdle(agent, token); assertLive(state, generation, entry, token); };
        try {
          await recheck();
          await releaseMount(state);
          record = { ...record, phase: 'preparing', reason: null, revision: (existing?.revision ?? 0) + 1 };
          selectionAttempted = true;
          await table.put(sessionId, record);
          await recheck();
          if (!proof.marker) agent.inject(bindingNotice(record));
          if (await service('sessions').flush(agent.session) !== true) fail('PERSISTENCE_UNAVAILABLE');
          await recheck();
          const check = await readiness(entry, agent, token);
          await recheck();
          if (check.status !== 'ready') fail(check.issues[0]?.code ?? 'PREREQUISITES_UNAVAILABLE');
          const presetIssues = await presetCheck(record.identity, agent);
          await recheck();
          if (presetIssues.some(row => row.code !== 'PRESET_MISMATCH')) fail(presetIssues[0].code);
          if (record.identity.requiredPreset && currentPreset(agent) !== record.identity.requiredPreset) {
            const boundary = service('sessionProjections').stateOf(agent.session, 'turnBoundary');
            if (!boundary) fail('TURN_BOUNDARY_UNAVAILABLE');
            if (boundary.lastTurn > 0 || boundary.openTurnStartSeq !== null) fail('PRESET_MISMATCH');
            await service('agentPresets').select(agent, record.identity.requiredPreset);
            await recheck();
            if (currentPreset(agent) !== record.identity.requiredPreset) fail('PRESET_MISMATCH');
          }
          await mount(state, entry, record, token, generation);
          await recheck();
          record = { ...record, phase: 'bound', reason: null, revision: record.revision + 1 };
          await table.put(sessionId, record);
          await recheck();
          state.checked = true;
          state.reason = null;
        } catch (error) {
          if (!selectionAttempted) throw error;
          await blocked(state, record, error.code ?? (token.aborted ? 'ACTIVATION_CANCELED' : 'ACTIVATION_FAILED'));
        }
        finally { state.busy = false; }
        return readBinding(sessionId);
      });
    } catch (error) {
      state.busy = false;
      // No maintenance reservation means no selection side effects took place.
      throw error instanceof AssistantError ? error : new AssistantError('SESSION_BUSY', 409);
    }
  }
  const runtime = {
    register, list, detail, previewBind, bind: options => track(bind(options)), readBinding,
    delegate(options) {
      assertAdmission(options.agent);
      return delegateNative({ agents: service('agents'), subagents: service('subagents') }, options);
    },
    dispose: onceAsync(async () => {
      disposed = true;
      initError = 'RUNTIME_UNAVAILABLE';
      closing.abort();
      for (const state of states.values()) {
        let selected = !!state.mounted || !!state.intent || state.busy;
        try { selected ||= !!recordFor(state.agent.id) || !!evidence(state.agent).marker; } catch { /* absent evidence does not authorize canceling unrelated work */ }
        if (selected) state.agent.cancel({ kind: 'hook', reason: 'Assistant base unavailable' }, { keepInbox: true });
      }
      await Promise.allSettled([...registry.values()].map(entry => entry.unregister()));
      await Promise.allSettled([...tasks]);
      await Promise.allSettled([...states.values()].map(detach));
      for (const dispose of listeners.reverse()) await dispose();
      await domain?.close();
    }),
  };
  runtime.ready = (async () => {
    try {
      for (const name of ['agents','sessions','sessionProjections','storageDomain','tools']) if (!service(name)) fail(`MISSING_${name.replace(/[A-Z]/g, s => `_${s}`).toUpperCase()}`, 503);
      listeners.push(service('sessionProjections').register(evidenceProjection));
      domain = await service('storageDomain').open(domainSpec);
      if (disposed) { await domain.close(); return; }
      table = domain.table('bindings');
      initialized = true;
      initError = null;
      for (const agent of service('agents').list()) stateFor(agent);
    } catch (error) { initError = error.code ?? 'STORAGE_UNAVAILABLE'; }
  })();
  // Do not invoke preset resolution during Host apply: its native audit may await Loader settlement.
  return runtime;
}
