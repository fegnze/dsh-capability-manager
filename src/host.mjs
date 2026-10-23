import z from '@deepseek-ai/schemastery';
import * as McpClient from '@deepseek-ai/dsh-mcp-client';
import { randomUUID } from 'node:crypto';
import { createManager as createSkillCatalog } from './skills/manager.mjs';
import { createSkillsSide } from './skills/side.mjs';
import { createManager as createMcpManager } from './mcp/manager.mjs';
import { projectServer } from './mcp/projection.mjs';
import { createHandler, ROUTE } from './http.mjs';
import { ManagerError } from './errors.mjs';
import { createAssistantRuntime } from './assistants/index.mjs';
import { createAssistantControl, registerAssistantQueryTool } from './assistant-control.mjs';
export const name = 'dsh-capability-manager';
export const inject = ['webServer','connection','skills','agents','workingDirectory','agentPresets','fs','tools','configEditor','sessions','sessionProjections','storageDomain'];
const Root = z.object({ id: z.string(), path: z.string(), trusted: z.boolean().default(false), recoveryOutsideDiscovery: z.boolean().default(false) });
export const Config = z.object({
  roots: z.array(Root).default([]),
  servers: z.array(z.object({ enabled: z.boolean().default(false), client: McpClient.Config })).default([]),
});
export async function apply(ctx, config = {}) {
  const roots = config.roots ?? [];
  const servers = config.servers ?? [];
  const catalog = createSkillCatalog({ skills: ctx.skills, agents: ctx.agents, workingDirectory: ctx.workingDirectory, agentPresets: ctx.agentPresets });
  // A page has no session of its own: read through the first live agent so the
  // preset-mounted providers stay visible, and let an explicit id override it.
  const withLiveAgent = options => (options?.sessionId || !ctx.agents.list().length ? options : { ...options, sessionId: ctx.agents.list()[0].id });
  const scoped = {
    list: options => catalog.list(withLiveAgent(options)),
    detail: options => catalog.detail(withLiveAgent(options)),
    // Optional service: read it through ctx.get so a profile without the
    // workspace registry degrades to "no projects" instead of failing the page.
    projects: async () => {
      try {
        const registry = ctx.get('workspaceRegistry');
        return (registry?.list?.() ?? []).map(workspace => ({ id: workspace.id, path: workspace.path, title: workspace.title || workspace.path }));
      } catch { return []; }
    },
  };
  const skills = createSkillsSide({ ctx, roots, catalog: scoped });
  const mcp = createMcpSide(ctx, servers);
  const assistantRuntime = createAssistantRuntime(ctx);
  ctx.provide('dshAssistants', assistantRuntime);
  ctx.effect(() => () => assistantRuntime.dispose());
  const assistants = createAssistantControl(assistantRuntime);
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler: createHandler({ skills, mcp, assistants, admit: req => ctx.connection.admit(req), isBrowserPeer: peer => peer === ctx.connection.browserPeer }) }));
  registerTools(ctx, skills, mcp);
  ctx.effect(() => registerAssistantQueryTool(ctx, assistants));
  await mountServers(ctx, servers);
}
function createMcpSide(ctx, servers) {
  const editor = ctx.configEditor;
  const ownEntry = () => editor.entries().find(entry => entry.fiber === ctx.fiber);
  const own = () => {
    const entry = ownEntry();
    if (!entry) throw new ManagerError('CONFIGURATION_UNAVAILABLE', 503);
    return entry;
  };
  return createMcpManager({
    read: () => structuredClone(own().options.config ?? {}),
    edit: change => editor.edit(own(), change),
    external: () => editor.entries()
      .filter(entry => entry.options.name === '@deepseek-ai/dsh-mcp-client' && entry.fiber !== ctx.fiber)
      .map(entry => projectServer(entry.options.config ?? {}, { source: 'external', enabled: !entry.options.disabled, phase: null })),
    tools: () => ctx.tools.schemas(),
    checkConnection: async server => {
      const result = await ctx.tools.execute({ callId: randomUUID(), name: 'list_mcp_resources', arguments: { server }, signal: AbortSignal.timeout(10000) });
      return result.isError === false;
    },
  });
}
function registerTools(ctx, skills, mcp) {
  // Inspection and preview only: mutations stay behind the owner's browser action.
  ctx.effect(() => ctx.tools.register({
    name: 'skill_manager',
    description: 'Inspect the effective skill catalog for a session, read authorized local skill files, preview a local skill change, or reveal an authorized file. Installing, editing, removing or purging requires the owner to confirm the preview in the Skill Manager page.',
    parameters: { type: 'object', additionalProperties: false, required: ['action'], properties: {
      action: { type: 'string', enum: ['list', 'detail', 'local', 'raw', 'preview', 'recoveryDetail'] },
      sessionId: { type: 'string' }, cwd: { type: 'string' }, name: { type: 'string' }, rootId: { type: 'string' }, path: { type: 'string' },
      operation: { type: 'string', enum: ['edit', 'create', 'import', 'remove', 'purge'] },
      sourcePath: { type: 'string' }, raw: { type: 'string' }, version: { type: 'string' }, recoveryId: { type: 'string' },
    } },
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async args => {
      const { action, ...options } = args ?? {};
      if (!['list', 'detail', 'local', 'raw', 'preview', 'recoveryDetail'].includes(action) || typeof skills[action] !== 'function') throw new ManagerError('UNSUPPORTED_ACTION');
      return skills[action](options);
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'mcp_manager',
    description: "Inspect the MCP servers this plugin manages and other plugins' read-only servers. Enabling, importing, editing or removing a server requires the owner to confirm it in the MCP page.",
    parameters: { type: 'object', additionalProperties: false, required: ['action'], properties: {
      action: { type: 'string', enum: ['list', 'preview'] }, text: { type: 'string' },
    } },
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async args => {
      const { action, ...rest } = args ?? {};
      if (!['list', 'preview'].includes(action) || typeof mcp[action] !== 'function') throw new ManagerError('UNSUPPORTED_ACTION');
      return mcp[action](rest);
    },
  }));
}
async function mountServers(ctx, servers) {
  const externalNames = new Set(ctx.configEditor.entries()
    .filter(entry => entry.options.name === '@deepseek-ai/dsh-mcp-client' && entry.fiber !== ctx.fiber)
    .map(entry => entry.options.config?.serverName));
  const names = new Set();
  for (const row of servers) {
    if (names.has(row.client.serverName)) throw new ManagerError('NAME_CONFLICT');
    names.add(row.client.serverName);
  }
  // Parent-fiber ownership guarantees cleanup; a failed server keeps the page usable.
  for (const row of servers) if (row.enabled) {
    if (externalNames.has(row.client.serverName)) { ctx.logger?.warn('MCP namespace conflict; managed child not started'); continue; }
    try { await ctx.plugin(McpClient, { ...row.client, failOnStartupError: false }); }
    catch { ctx.logger?.warn('MCP child activation failed; connection state is unknown'); }
  }
}
