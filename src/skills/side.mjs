import * as nodeFs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ManagerError } from '../errors.mjs';
import { validateRaw } from './grammar.mjs';
import { createLocalStore } from './local-store.mjs';
import { createOperations } from './operations.mjs';

const inside = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const readonly = reason => ({ readOnly: true, reason });

// 目录授权来自主机上下文，不来自原生 catalog 返回的文件路径。
export function createSkillsSide({ ctx, roots = [], catalog, home = os.homedir(), fs = nodeFs, storeFactory = createLocalStore }) {
  const adapters = new Map(), previews = new Map();
  const validPath = value => typeof value === 'string' && path.isAbsolute(value) && path.resolve(value) === value && !/[\x00-\x1f\x7f]/.test(value) && value.length <= 4096;
  async function safeDirectory(value) {
    if (!validPath(value)) throw new ManagerError('INVALID_PATH');
    let cursor = path.parse(value).root;
    for (const part of value.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      const stat = await fs.lstat(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ManagerError('UNSAFE_ANCESTOR', 403);
    }
  }
  function trustedContexts() {
    const result = [];
    for (const agent of ctx.agents.list()) {
      const cwd = ctx.workingDirectory.get(agent.session);
      if (validPath(cwd)) result.push({ cwd, sessionId: agent.id });
    }
    try {
      for (const workspace of ctx.get('workspaceRegistry')?.list?.() ?? []) {
        if (validPath(workspace.path)) result.push({ cwd: workspace.path, boundary: workspace.path });
      }
    } catch {}
    return result;
  }
  async function projectFor(options = {}) {
    const contexts = trustedContexts();
    let cwd = options.cwd;
    if (options.sessionId !== undefined) {
      const agent = contexts.find(item => item.sessionId === options.sessionId);
      if (!agent) throw new ManagerError('SESSION_NOT_LIVE', 404);
      cwd ??= agent.cwd;
    }
    cwd ??= contexts.find(item => item.sessionId)?.cwd;
    if (cwd === undefined) return null;
    // 只接受主机已登记的精确 cwd，不能用客户端任意路径授予删除权限。
    const trusted = contexts.find(item => item.cwd === cwd && item.boundary) ?? contexts.find(item => item.cwd === cwd);
    if (!trusted || !validPath(cwd)) throw new ManagerError('CWD_NOT_AUTHORIZED', 403);
    await safeDirectory(cwd);
    const boundary = contexts.filter(item => item.boundary && inside(item.boundary, cwd)).sort((a, b) => b.cwd.length - a.cwd.length)[0]?.boundary;
    let current = cwd;
    while (true) {
      try {
        const git = await fs.lstat(path.join(current, '.git'));
        if (git.isSymbolicLink() || (!git.isDirectory() && !git.isFile())) throw new ManagerError('UNSAFE_PROJECT', 403);
        return current;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (current === boundary || path.dirname(current) === current) break;
      current = path.dirname(current);
    }
    return boundary ?? cwd;
  }
  async function selected(options = {}) {
    const configured = roots.map(root => ({ ...root, scope: 'custom', ...(root.trusted !== true ? readonly('ROOT_NOT_AUTHORIZED') : root.recoveryOutsideDiscovery !== true ? readonly('RECOVERY_DISCOVERY_ACK_REQUIRED') : {}) }));
    const defaults = [{ id: 'default-global', path: path.join(home, '.agents', 'skills'), scope: 'global', trusted: true }];
    try {
      const project = await projectFor(options);
      if (project) defaults.push({ id: `default-project-${createHash('sha256').update(project).digest('hex').slice(0, 16)}`, path: path.join(project, '.agents', 'skills'), scope: 'project', project, trusted: true });
    } catch (error) {
      if (options.cwd !== undefined || options.sessionId !== undefined) throw error;
    }
    const result = [...configured];
    for (const root of defaults) if (!result.some(other => other.path === root.path)) result.push(root);
    for (const root of result) {
      if (typeof root.id !== 'string' || !root.id || result.filter(other => other.id === root.id).length !== 1) Object.assign(root, readonly('ROOT_NOT_AUTHORIZED'));
      if (root.readOnly) continue;
      try {
        await safeDirectory(root.path);
        const state = path.join(path.dirname(root.path), `.dsh-capability-manager-${path.basename(root.path)}-state`);
        if (ctx.fs.processPathFromHostPath(root.path) !== root.path || ctx.fs.processPathFromHostPath(state) !== state) throw new ManagerError('HOST_FILESYSTEM_MAPPING_REQUIRED', 403);
        for (const other of result) {
          if (!validPath(other.path)) throw new ManagerError('INVALID_PATH');
          if (inside(other.path, state) || inside(state, other.path)) throw new ManagerError('STATE_DISCOVERY_CONFLICT', 403);
          if (other !== root && (inside(other.path, root.path) || inside(root.path, other.path))) throw new ManagerError('ROOT_OVERLAP', 403);
        }
      } catch (error) { Object.assign(root, readonly(error.code === 'ENOENT' ? 'ROOT_NOT_FOUND' : error.code ?? 'READ_FAILED')); }
    }
    return result;
  }
  async function adapter(root) {
    const key = `${root.id}\0${root.path}`;
    if (!adapters.has(key)) {
      const pending = storeFactory({
        roots: [root], validateRaw, authorize: async ({ authorization }) => authorization?.owner === true,
        createFlat: async ({ path: filename, raw }) => ctx.fs.writeText(await ctx.fs.resolve(filename), raw, { kind: 'createIfAbsent' }),
        mapPath: value => {
          const mapped = ctx.fs.processPathFromHostPath(value);
          if (mapped !== value) throw new ManagerError('HOST_FILESYSTEM_MAPPING_REQUIRED', 403);
          return mapped;
        },
      }).then(store => createOperations({ store, fs: ctx.fs, roots: [root] }));
      adapters.set(key, pending);
    }
    return adapters.get(key);
  }
  async function authorized(options) {
    const root = (await selected(options)).find(item => item.id === options.rootId);
    if (!root || root.readOnly) throw new ManagerError(root?.reason ?? 'ROOT_NOT_AUTHORIZED', 403);
    return { root, operations: await adapter(root) };
  }
  async function management(skill, options) {
    if (skill.source === 'bundled') return readonly('BUNDLED_READ_ONLY');
    if (!validPath(skill.path)) return readonly('CATALOG_PATH_UNAVAILABLE');
    let candidates;
    try { candidates = await selected(options); } catch (error) { return readonly(error.code ?? 'READ_FAILED'); }
    for (const root of candidates) {
      const relative = path.relative(root.path, skill.path);
      const parts = relative.split(path.sep);
      const object = parts.length === 1 && parts[0].endsWith('.md') ? parts[0] : parts.length === 2 && parts[1] === 'SKILL.md' ? parts[0] : null;
      if (!object || object === '..' || object === '.' || !inside(root.path, skill.path)) continue;
      if (root.readOnly) return readonly(root.reason);
      try {
        const local = await (await adapter(root)).local();
        const item = local.items.find(item => item.path === object && !item.readOnly);
        if (!item || item.name !== skill.name || (parts.length === 1 ? item.kind !== 'flat' : item.kind !== 'directory')) return readonly('LOCAL_INVENTORY_UNSAFE');
        return { rootId: root.id, path: object };
      } catch (error) { return readonly(error.code ?? 'LOCAL_INVENTORY_UNSAFE'); }
    }
    return readonly('ROOT_NOT_AUTHORIZED');
  }
  return {
    ...catalog,
    async detail(options) {
      const value = await catalog.detail(options);
      const access = await management(value.skill, { ...options, cwd: options?.cwd ?? value.context?.cwd ?? undefined });
      return { ...value, skill: { ...value.skill, management: access }, management: access, readOnly: access.readOnly === true };
    },
    async local(options) {
      const selectedRoots = await selected(options), items = [], recovery = [];
      for (const root of selectedRoots) {
        if (root.readOnly) continue;
        try {
          const local = await (await adapter(root)).local();
          items.push(...local.items);
          recovery.push(...local.recovery.filter(record => record.operation === 'remove' && ['available', 'needs-reconciliation', 'trashed', 'purged'].includes(record.status)));
        } catch (error) { Object.assign(root, readonly(error.code ?? 'READ_FAILED')); }
      }
      const publicRoots = selectedRoots.map(({ trusted, recoveryOutsideDiscovery, ...root }) => root);
      return { root: publicRoots.find(root => root.scope === 'project') ?? publicRoots.find(root => root.scope === 'global') ?? null, roots: publicRoots, items, recovery, capabilities: { edit: false, create: false, directoryTransactions: process.platform === 'darwin', purge: process.platform === 'darwin' } };
    },
    async raw(options) { return (await authorized(options)).operations.raw(options); },
    async recoveryDetail(options) { return (await authorized(options)).operations.recoveryDetail(options); },
    async reveal(options) {
      const { root, operations } = await authorized(options);
      return operations.reveal(options);
    },
    async preview(options) {
      const { root, operations } = await authorized(options);
      if (root.scope !== 'custom' && !['remove', 'purge'].includes(options.operation)) throw new ManagerError('UNSUPPORTED_ACTION');
      for (const [id, preview] of previews) if (preview.expiresAt < Date.now()) previews.delete(id);
      if (previews.size >= 100) throw new ManagerError('TOO_MANY_PREVIEWS', 429);
      const value = await operations.preview(options);
      previews.set(value.previewId, { operations, rootId: root.id, path: root.path, expiresAt: value.expiresAt });
      return value;
    },
    async commit(options) {
      const preview = previews.get(options.previewId);
      if (!preview || preview.expiresAt < Date.now()) throw new ManagerError('PREVIEW_EXPIRED', 409);
      const { root } = await authorized({ ...options, rootId: preview.rootId });
      if (root.path !== preview.path) throw new ManagerError('ROOT_NOT_AUTHORIZED', 403);
      if (options.confirm !== true) throw new ManagerError('CONFIRM_REQUIRED');
      const result = await preview.operations.commit(options);
      previews.delete(options.previewId);
      return result;
    },
  };
}
