import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSkillsSide } from '../src/skills/side.mjs';

const raw = '---\nname: sample\ndescription: 测试技能\n---\n正文\n';
async function fixture(run) {
  const base = await fs.realpath(os.tmpdir());
  const home = await fs.mkdtemp(path.join(base, 'dsh-skills-side-test-'));
  const project = path.join(home, 'project'), nested = path.join(project, 'nested'), other = path.join(home, 'other');
  await fs.mkdir(nested, { recursive: true }); await fs.mkdir(path.join(project, '.git')); await fs.mkdir(other);
  let cwd = nested, catalogPath = path.join(home, '.agents/skills/sample.md');
  const agent = { id: 'live', session: {} };
  const ctx = {
    agents: { list: () => [agent] }, workingDirectory: { get: () => cwd },
    get: () => ({ list: () => [{ id: 'project', path: project }, { id: 'other', path: other }] }),
    fs: { processPathFromHostPath: value => value },
  };
  const catalog = { detail: async () => ({ skill: { name: 'sample', path: catalogPath }, context: { cwd } }), list: async () => ({ skills: [] }) };
  const side = createSkillsSide({ ctx, catalog, home });
  try { await run({ home, project, nested, other, side, ctx, catalog, setCwd: value => { cwd = value; }, setPath: value => { catalogPath = value; } }); }
  finally { assert.equal(path.dirname(home), base); assert.ok(path.basename(home).startsWith('dsh-skills-side-test-')); await fs.rm(home, { recursive: true, force: true }); }
}
async function skillRoot(root, bundle = false) {
  await fs.mkdir(root, { recursive: true });
  if (bundle) { await fs.mkdir(path.join(root, 'sample')); await fs.writeFile(path.join(root, 'sample/SKILL.md'), raw); }
  else await fs.writeFile(path.join(root, 'sample.md'), raw);
}

test('默认目录按主机cwd寻找最近git，缺失不创建也不影响local页面', async () => fixture(async ({ side, home, project, nested }) => {
  const value = await side.local();
  assert.equal(value.roots.find(root => root.scope === 'global').path, path.join(home, '.agents/skills'));
  assert.equal(value.root.path, path.join(project, '.agents/skills'));
  assert.ok(value.roots.every(root => root.reason === 'ROOT_NOT_FOUND'));
  await assert.rejects(fs.stat(path.join(home, '.agents')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(project, '.agents')), { code: 'ENOENT' });
  await fs.mkdir(path.join(nested, '.git'));
  assert.equal((await side.local()).root.path, path.join(nested, '.agents/skills'));
}));

test('任意客户端cwd不能授予目录权限，可信workspace可切换且受边界限制', async () => fixture(async ({ side, home, other }) => {
  await assert.rejects(side.local({ cwd: home }), { code: 'CWD_NOT_AUTHORIZED' });
  const value = await side.local({ cwd: other });
  assert.equal(value.root.path, path.join(other, '.agents/skills'));
  await assert.rejects(side.preview({ cwd: home, operation: 'remove', rootId: 'default-global', path: 'sample.md' }), { code: 'CWD_NOT_AUTHORIZED' });
}));

test('精确catalog路径与安全inventory才可管理，原生其他路径仍只读', { skip: process.platform !== 'darwin' }, async () => fixture(async ({ side, home, setPath }) => {
  const root = path.join(home, '.agents/skills'); await skillRoot(root);
  assert.deepEqual((await side.detail({ name: 'sample' })).management, { rootId: 'default-global', path: 'sample.md' });
  setPath(path.join(home, 'ungranted/sample.md'));
  assert.equal((await side.detail({ name: 'sample' })).management.reason, 'ROOT_NOT_AUTHORIZED');
  setPath(path.join(root, 'deeper/sample.md'));
  assert.equal((await side.detail({ name: 'sample' })).management.reason, 'ROOT_NOT_AUTHORIZED');
  await fs.symlink(path.join(root, 'sample.md'), path.join(root, 'linked.md'));
  setPath(path.join(root, 'linked.md'));
  assert.equal((await side.detail({ name: 'sample' })).management.reason, 'LOCAL_INVENTORY_UNSAFE');
}));

test('目录symlink和非identity主机映射均fail closed', async () => fixture(async ({ side, home, ctx, other }) => {
  await fs.mkdir(path.join(home, '.agents')); await fs.symlink(other, path.join(home, '.agents/skills'));
  assert.equal((await side.local()).roots.find(root => root.scope === 'global').reason, 'UNSAFE_ANCESTOR');
  await fs.unlink(path.join(home, '.agents/skills')); await skillRoot(path.join(home, '.agents/skills'));
  ctx.fs.processPathFromHostPath = value => `/mapped${value}`;
  assert.equal((await side.local()).roots.find(root => root.scope === 'global').reason, 'HOST_FILESYSTEM_MAPPING_REQUIRED');
}));

test('项目preview不能切换cwd后commit，删除备份及有效回收可读取', { skip: process.platform !== 'darwin' }, async () => fixture(async ({ side, project, other }) => {
  await skillRoot(path.join(project, '.agents/skills'), true);
  const local = await side.local({ cwd: project });
  const rootId = local.root.id;
  const preview = await side.preview({ cwd: project, operation: 'remove', rootId, path: 'sample' });
  await assert.rejects(side.commit({ cwd: other, previewId: preview.previewId }), { code: 'ROOT_NOT_AUTHORIZED' });
  const committed = await side.commit({ cwd: project, confirm: true, previewId: preview.previewId });
  const recoveryId = committed.result.recoveryId;
  const next = await side.local({ cwd: project });
  assert.equal(next.recovery.length, 1);
  assert.equal(next.recovery[0].status, 'available');
  const detail = await side.recoveryDetail({ cwd: project, rootId, recoveryId });
  assert.equal(detail.raw, raw); assert.equal(detail.readOnly, false); assert.equal(detail.restorable, undefined);
  await assert.rejects(side.preview({ cwd: project, operation: 'restore', rootId, recoveryId }), { code: 'UNSUPPORTED_ACTION' });
  const purge = await side.preview({ cwd: project, operation: 'purge', rootId, recoveryId });
  assert.ok(purge.summary.affectedPaths?.length);
}));

test('显式root必须授权且确认回收在发现范围外，匹配目录包可管理', { skip: process.platform !== 'darwin' }, async () => fixture(async ({ ctx, catalog, home, setPath }) => {
  const root = path.join(home, 'custom'); await skillRoot(root, true); setPath(path.join(root, 'sample/SKILL.md'));
  const untrusted = createSkillsSide({ ctx, catalog, home, roots: [{ id: 'custom', path: root, trusted: true }] });
  assert.equal((await untrusted.detail({ name: 'sample' })).management.reason, 'RECOVERY_DISCOVERY_ACK_REQUIRED');
  const side = createSkillsSide({ ctx, catalog, home, roots: [{ id: 'custom', path: root, trusted: true, recoveryOutsideDiscovery: true }] });
  assert.deepEqual((await side.detail({ name: 'sample' })).management, { rootId: 'custom', path: 'sample' });
}));
