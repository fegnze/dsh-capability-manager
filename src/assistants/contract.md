# Assistant runtime contract v1

This is the capability manager's own API, not an additional DSH Agent host, package manager or workflow authority. Requires the native DSH 0.2.1-rc.2 contracts inspected for this change.

## Host integration

`createAssistantRuntime(ctx)` from `./index.mjs` installs admission guards synchronously, starts storage initialization, and returns the object to publish as `ctx.dshAssistants`. Its `ready` Promise settles after initialization; an initialization failure remains a blocked runtime, never an empty registry. The Host owns `runtime.dispose()` through its context effect. The runtime uses optional `ctx.get(name)` lookups for `storageDomain`, `sessionProjections`, `sessions`, `agents`, `agentPresets`, `tools` and `subagents`; native missing capabilities return explicit unavailability. The runtime does not install dependencies.

## Package registration

```ts
const unregister = ctx.dshAssistants.register(ctx, {
  manifest: {
    schemaVersion: 1,
    id: 'plugin-development',
    name: 'Plugin development',
    description: 'Develop and deliver DSH plugins.',
    package: {
      name: '@fegnze/dsh-assistant-plugin-dev',
      version: '0.1.0',
      contentDigest: '<64 lowercase SHA-256 hex characters>',
    },
    requires: { agentPreset: 'cordis' }, // optional, never a copied preset
    capabilities: [{ id: 'validate', title: 'Validate', description: 'Validate one project.' }],
  },
  async check({ agent, signal }) {
    // No installs, authentication, registration, task submission or mutation.
    return { status: 'ready', issues: [] };
  },
  async mount({ ctx: agentCtx, agent, signal, manifest }) {
    const disposers = [];
    try {
      // Use agentCtx.get('tools').register, get('skills').register,
      // and get('systemPrompt').section. Refuse absent native services;
      // scoped contexts do not necessarily inherit the package's inject API.
      // Register named capabilities, not a duplicate Agent or global persona.
      // All partial work must unwind if installation rejects or is aborted.
      return { async dispose() { for (const off of disposers.reverse()) await off(); } };
    } catch (error) {
      for (const off of disposers.reverse()) await off();
      throw error;
    }
  },
});
```

`register(ownerCtx, definition)` is synchronous and returns an idempotent asynchronous disposer. The runtime automatically owns that disposer with both `ownerCtx.effect` and the base lifecycle; callers need not add another effect. Duplicate live IDs are rejected. `manifest` is a strict, detached, deeply frozen JSON object; unknown fields, accessors, cycles and non-JSON values are refused. `name`, `description`, capability `title` and `description` are plain strings. `requires` and `requires.agentPreset` may be omitted. `capabilities` may be empty.

`check` returns `{ status: 'ready' | 'configuration-required' | 'incompatible' | 'unavailable', issues: Array<{ code, message, capability?, remediation? }> }`; every field is a string. Do not return secrets or raw process output. Package-owned user configuration and recovery state stay outside the immutable package and outside the base binding domain.

`mount` receives the exact live Agent's scoped context and an abort signal. It must return `{ dispose(): void | Promise<void> }`. It cannot change preset, wake/submit work, acquire permissions, start an MCP host or create an Agent host. Its disposer must release **every** contributed tool, skill, section and process effect. It must clean partially installed effects before rejecting. The base separately tracks the returned handle and releases it when either the Agent or package ends. When a package is removed, availability is revoked synchronously before cancellation/drain/cleanup. Asynchronous mount results that arrive after revocation are immediately disposed.

The digest covers all runtime code, Skills, prompts and templates, not only the manifest. It is supplied by an already-authorized trusted package and detects content drift; it is **not** a signature or a hostile-plugin sandbox.

## Public control plane

- `list({ sessionId?, signal? } = {}) -> Promise<{ assistants, binding, available, issues }>`: bounded capability summaries and current binding; no native installation-state claims.
- `detail({ id, sessionId?, signal? }) -> Promise<{ manifest, readiness, binding, available }>`.
- `previewBind({ sessionId, id, signal? }) -> Promise<{ sessionId, id, identity, revision, canSelect, canBind, issues, currentPreset, requiredPreset, continuationPrompt, binding }>`: exact live session, readiness and safe-idle preflight; does not write or select a preset.
- `bind({ sessionId, id, revision, confirm: true, signal? }) -> Promise<BindingView>`: first explicit binding, or exact-identity retry only. `revision` is the opaque preview token. Confirmation is only an intent check, **not authorization**: the Host HTTP adapter must admit the authenticated browser owner and must not expose this action to model tools. A preset-mismatched started session records a blocked selection and returns recovery guidance. It cannot select a different assistant, upgrade the saved identity, unbind, or start a task.
- `readBinding(sessionOrId) -> BindingView`: synchronous current state for UI and admission. A missing/corrupt/uninitialized evidence capability reports blocked, not unbound.
- `delegate({ agent, provider, label, prompt, context, agentPreset?, agentOptions?, outputSchema?, depthLimit?, signal?, delivery? })`: validates native provider capability and `context: 'clean' | 'inherited'`, then returns the native activation handle. It does not bind a child assistant. `delivery` defaults to `parent`. No automatic retries.

`BindingView` includes `sessionId`, `phase: 'unbound' | 'preparing' | 'bound' | 'blocked'`, `identity` when selected, integer `revision`, `reason` when blocked, `continuationPrompt`, and `canSubmit`. Selection failures keep a visible blocked binding. Retry requires the same assistant/package/version/contentDigest/preset identity; changed implementations require a new session.

## Frozen JSON response shapes

Optional JSON values are represented as `null`, not `undefined`. Native handles/callbacks never cross HTTP. Operational errors throw `AssistantError` with fixed `code` and integer `status`; successful binding may return `phase: 'blocked'`, which is not successful activation.

```ts
type Issue = { code: string; message: string; capability?: string; remediation?: string };
type Identity = { assistantId: string; packageName: string; packageVersion: string; contentDigest: string; requiredPreset: string | null };
type Readiness = { status: 'ready' | 'configuration-required' | 'incompatible' | 'unavailable'; issues: Issue[] };
type BindingView = {
  sessionId: string;
  phase: 'unbound' | 'preparing' | 'bound' | 'blocked';
  identity: Identity | null;
  revision: number;
  reason: string | null;
  continuationPrompt: string | null;
  canSubmit: boolean;
};
type AssistantSummary = {
  id: string; name: string; description: string;
  package: { name: string; version: string; contentDigest: string };
  requiredPreset: string | null;
  capabilities: { id: string; title: string; description: string }[];
  readiness: Readiness;
};
// list()
{ assistants: AssistantSummary[]; binding: BindingView | null; available: boolean; issues: Issue[] }
// detail()
{ manifest: Manifest; readiness: Readiness; binding: BindingView | null; available: boolean }
// previewBind()
{
  sessionId: string; id: string; identity: Identity;
  revision: string; // opaque single-use preview receipt; not binding revision
  canSelect: boolean; // safe to confirm this selection; UI enables confirmation using this
  canBind: boolean; // activation possible now; false may still record blocked selection
  issues: Issue[]; currentPreset: string | null; requiredPreset: string | null;
  continuationPrompt: string | null; binding: BindingView;
}
// bind() and readBinding()
BindingView
```

Host wiring is `const runtime = createAssistantRuntime(ctx); ctx.provide('dshAssistants', runtime); ctx.effect(() => () => runtime.dispose());` from `src/assistants/index.mjs`. Do not await `ready` inside Host `apply`; native preset audits may await the Loader, which would deadlock an applying consumer. HTTP list/detail/preview/bind await `runtime.ready` internally. The runtime installs guards before initialization and reports unavailability if dependencies are missing. `readBinding` never resumes a cold session; session IDs absent from the live registry return stored identity as blocked (`SESSION_NOT_LIVE`) until native resume has reconstructed evidence.

## Persistence and evidence

The base alone opens `storageDomain` domain `dsh_assistants`, version 1, table `bindings`, keyed by native session ID. The configured native backend chooses its physical location. No `invalidRecords: 'backup-and-skip'`, config-editor session rows or private filesystem database is used. Native domain writes are serialized and durable before resolving; there is no cross-record transaction assumption.

A pure native session projection folds ordinary `agent/inbox/spliced` evidence with producer `source.kind: 'dsh-assistant-binding'` and exact `source.sessionId`. A short, explicitly machine-authored notice is inserted by `Agent.inject`; it does not wake the driver. Its exact identity is paired with the sidecar. Only notices naming the projection's own header ID count, so inherited fork history does not bind a child. `sessions.flush(session)` must return true before activation can be reported as durable. Production does not scan `snapshotEvents` or append custom event types. Missing sidecar with evidence, conflicting evidence or unsupported evidence formats blocks admission. Simultaneous destruction of both independent copies is outside the detectable boundary.

Admission guards precede storage initialization. Activation requires idle, no queued user work, and no active descendants, and verifies exact live Agent/generation again after each asynchronous boundary. `agent/pre-step` rejection consumes already-claimed input; it is **not a queue hold**. UI should prevent blocked submissions and show the copyable continuation prompt. The base never automatically resubmits rejected input. `agent/request` and tool guards recheck availability because prompt assembly precedes the pre-step waterfall in the current runtime.

A bound Agent's `plugin_manager` tool is denied only for exact `remove_bundle` or `set_bundle(enabled:false)` targets matching its assistant package or the capability-manager base. Use the native Plugins page for those operations, so an unload cannot await the tool turn that caused it. Other packages and non-destructive native manager operations are not denied. Unexpected same-Agent unload origins revoke admission synchronously and defer their drain/cleanup until that Agent is idle, avoiding self-wait. This is a liveness boundary, not a replacement package-manager authority or hostile-plugin sandbox.

Normal teardown does not rewrite a durable successful selection into a permanently blocked row. The immutable identity itself is the tombstone; a missing/changed package still blocks cold resume, while the exact package can restore under the native creation or maintenance boundary. A corrupt record or record/marker mismatch cannot be repaired by manufacturing new evidence. Missing sidecar can be repaired only by explicitly selecting the exact identity retained in the native evidence.

A completely uninstalled/disabled base has no remaining interception point and cannot protect future cold resumes. Shared MCP, projects and credentials are not deleted. Reinstall the base/package or continue in a new session; this limitation must be disclosed rather than patched around with core edits or a fake preset.
