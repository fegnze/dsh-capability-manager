import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// All test dependencies are declared by this package. A missing dependency is
// a setup failure, never a skipped test or a lookup in a personal workspace.
const localRequire = createRequire(import.meta.url);
const { parseHTML } = localRequire('linkedom');
const React = localRequire('react');
const { createRoot } = localRequire('react-dom/client');
const cordis = localRequire.resolve('@deepseek-ai/cordis');
const cordisVersion = localRequire('@deepseek-ai/cordis/package.json').version;
assert.equal(cordisVersion, '4.0.5', 'Cordis 必须与已核实桌面版本相同');
const { Context } = await import(pathToFileURL(cordis));
const clientTest = test;
const cwd = '/mock/project';
const snapshots = [];
const wait = () => new Promise(resolve => setImmediate(resolve));

async function fixture(run, { surface = 'main', assistantPhase = 'unbound', initialFailure = '', assistantStatus = 'ready', canSelect = true, previewIdentity = {}, missingPackage = false } = {}) {
  const { window, document } = parseHTML('<!doctype html><html><head></head><body><div id="root"></div></body></html>');
  const old = new Map();
  for (const [key, value] of Object.entries({ window, document, HTMLElement: window.HTMLElement, Node: window.Node, Event: window.Event, navigator: { userAgent: 'node' } })) {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  old.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
  const requests = [];
  let failure = initialFailure, removed = false, purged = false, delayedAction = '';
  const releases = [];
  // linkedom has no browser top layer or layout engine. Exercise the real
  // component's native-dialog lifecycle with a narrowly scoped platform shim;
  // viewport geometry still requires the installed desktop acceptance check.
  const nativeDialogs = [];
  window.HTMLElement.prototype.showModal = function () {
    assert.equal(this.localName, 'dialog');
    assert.equal(this.isConnected, true);
    nativeDialogs.push({ action: 'showModal', node: this });
    this.setAttribute('open', '');
  };
  window.HTMLElement.prototype.close = function () {
    assert.equal(this.localName, 'dialog');
    nativeDialogs.push({ action: 'close', node: this });
    this.removeAttribute('open');
  };
  // linkedom does not implement focus ownership; use a minimal focus shim, while
  // rendering and all event propagation still run through real ReactDOM.
  let activeElement = document.body;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => activeElement });
  window.HTMLElement.prototype.focus = function () { activeElement = this; this.dispatchEvent(new window.Event('focusin', { bubbles: true })); };
  // ReactDOM was loaded before a browser existed; its legacy input-event branch
  // expects these hooks when the simulated browser focuses a textarea.
  window.HTMLElement.prototype.attachEvent = function () {};
  window.HTMLElement.prototype.detachEvent = function () {};
  const navigations = [], copied = [];
  navigator.clipboard = { async writeText(text) { if (failure === 'copy') throw Error('COPY_FAILED'); copied.push(text); } };
  const identity = { assistantId: 'plugin-development', packageName: '@fegnze/dsh-assistant-plugin-dev', packageVersion: '0.1.0', contentDigest: 'a'.repeat(64), requiredPreset: 'cordis' };
  const assistant = { id: identity.assistantId, name: '插件开发', description: '开发 DSH 插件', package: { name: identity.packageName, version: identity.packageVersion, contentDigest: identity.contentDigest }, requiredPreset: 'cordis', capabilities: [{ id: 'validate', title: '校验', description: '校验工程' }], readiness: { status: assistantStatus, issues: assistantStatus === 'ready' ? [] : [{ code: 'CONFIGURATION_REQUIRED', message: '缺少配置', remediation: '请设置配置路径' }] } };
  let binding = { sessionId: 'session-1', phase: assistantPhase, identity: assistantPhase === 'unbound' ? null : identity, revision: 0, reason: assistantPhase === 'blocked' ? 'PRESET_MISMATCH' : null, continuationPrompt: assistantPhase === 'blocked' ? '在新会话选择插件开发助理，继续验证工程。' : null, canSubmit: ['unbound', 'bound'].includes(assistantPhase) };
  let mismatch = false, previewReceipt = 0;
  const skill = { name: 'project-demo', description: '模拟项目技能，用于验证详情与删除流程', source: 'project-agents', invocation: { modelInvocable: true, userInvocable: true } };
  const globals = [{ ...skill, name: 'global-demo', description: '模拟全局技能', source: 'user-global' }];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input), 'http://localhost');
    assert.equal(url.pathname, '/dsh-capability-manager/api');
    const params = init.method === 'POST' ? JSON.parse(init.body) : Object.fromEntries(url.searchParams);
    requests.push({ ...params, method: init.method || 'GET', credentials: init.credentials, headers: init.headers });
    if (params.action === delayedAction) await new Promise(resolve => { releases.push(resolve); });
    if ((Array.isArray(failure) ? failure : [failure]).includes(params.action)) return { ok: false, json: async () => ({ ok: false, error: { code: 'MOCK_FAILURE' } }) };
    let value;
    if (params.tab === 'assistants') {
      if (missingPackage && ['detail', 'previewBind'].includes(params.action)) return { ok: false, json: async () => ({ ok: false, error: { code: 'ASSISTANT_NOT_FOUND' } }) };
      switch (params.action) {
        case 'list': value = { assistants: missingPackage ? [] : [assistant], binding: params.sessionId ? binding : null, available: true, issues: [] }; break;
        case 'binding': value = { ...binding, sessionId: params.sessionId }; break;
        case 'detail': value = { manifest: { schemaVersion: 1, id: assistant.id, name: assistant.name, description: assistant.description, package: assistant.package, capabilities: assistant.capabilities, requires: { agentPreset: 'cordis' } }, readiness: assistant.readiness, binding: params.sessionId ? binding : null, available: true }; break;
        case 'previewBind': value = { sessionId: params.sessionId, id: params.id, identity: { ...identity, ...previewIdentity }, revision: `receipt-${++previewReceipt}`, canSelect, canBind: canSelect && !mismatch, issues: mismatch ? [{ code: 'PRESET_MISMATCH', message: '会话已启动，预设不匹配', remediation: '请在新会话选择 cordis' }] : [], currentPreset: 'default', requiredPreset: 'cordis', continuationPrompt: mismatch ? '在新会话选择插件开发助理，继续验证工程。' : null, binding }; break;
        case 'bind': assert.equal(params.confirm, true); assert.equal(params.revision, `receipt-${previewReceipt}`); binding = { ...binding, identity, phase: mismatch ? 'blocked' : 'bound', reason: mismatch ? 'PRESET_MISMATCH' : null, canSubmit: !mismatch, continuationPrompt: mismatch ? '在新会话选择插件开发助理，继续验证工程。' : null, revision: 1 }; value = binding; break;
        default: throw Error(`Unknown assistant action ${params.action}`);
      }
    } else if (params.tab === 'mcp') {
      switch (params.action || 'list') {
        case 'list': value = { revision: 'mcp-revision', servers: [{ serverName: 'managed', enabled: true, transport: 'http', endpoint: 'https://example.test' }], external: [{ serverName: 'external', enabled: true, transport: 'stdio', source: 'external' }], tools: [{ name: 'mcp__managed__tool' }] }; break;
        case 'check': value = { successful: true, method: 'ping', at: '2026-10-22T08:00:00Z' }; break;
        case 'toggle': case 'remove': case 'import': assert.equal(params.confirm, true); value = {}; break;
        default: throw Error(`Unknown MCP action ${params.action}`);
      }
    } else switch (params.action || 'list') {
      case 'list': value = { complete: true, skills: params.cwd ? removed ? [] : [skill] : globals }; break;
      case 'projects': value = [{ id: 'project-1', path: cwd, title: '模拟项目' }]; break;
      case 'local': value = { roots: [{ id: 'project-root', path: `${cwd}/.agents/skills` }], items: params.cwd ? Array.from({ length: 46 }, (_, index) => ({ rootId: 'project-root', path: `draft-${index + 1}.md`, name: `draft-${index + 1}.md`, description: '尚未被技能目录识别的模拟文件' })) : [], recovery: params.cwd && !purged ? [{ rootId: 'project-root', id: 'recovery-1', name: 'old-demo', deletedAt: '2026-10-22T08:00:00Z', status: 'available' }, { rootId: 'project-root', id: 'already-trashed', name: '不应显示的已清除条目', status: 'trashed' }] : [] }; break;
      case 'detail': value = { skill: params.name === 'global-demo' ? { ...globals[0], path: '/mock/home/.agents/skills/global-demo/SKILL.md', provider: 'agents', content: '# 模拟全局技能', management: { rootId: 'default-global', path: 'global-demo' } } : { ...skill, path: `${cwd}/.agents/skills/project-demo/SKILL.md`, provider: 'agents', content: '# 模拟技能\n用于真实 DOM 验证，不会操作本地文件。', management: { rootId: 'project-root', path: 'project-demo' } } }; break;
      case 'raw': value = { raw: '# 模拟本地文件', inventory: [{ relative: 'draft.md' }], readOnly: false }; break;
      case 'recoveryDetail': value = { status: 'available', readOnly: false, metadata: { name: 'old-demo' }, deletedAt: '2026-10-22T08:00:00Z', originalPath: '/MUST_NOT_DISPLAY_ORIGINAL_LOCATION', originalRoot: '/MUST_NOT_DISPLAY_ORIGINAL_ROOT', restorable: true, raw: '# 模拟回收技能', inventory: [{ relative: 'SKILL.md' }, { relative: 'references/example.md' }] }; break;
      case 'reveal': value = { revealed: true }; break;
      case 'preview': value = { previewId: `preview-${params.operation}`, summary: { affectedPaths: params.operation === 'purge' ? ['/mock/recovery/recovery-1'] : [`${cwd}/.agents/skills/${params.path}`] } }; break;
      case 'commit': assert.equal(params.confirm, true); if (params.previewId === 'preview-purge') purged = true; else removed = true; value = { result: { status: purged ? 'trashed' : 'removed' } }; break;
      default: throw Error(`未预期请求：${JSON.stringify(params)}`);
    }
    return { ok: true, json: async () => ({ ok: true, value }) };
  };
  let loaded, loaderCalls = 0, factoryCalls = 0;
  window.__ModuleLoader__ = { load(module) { loaderCalls++; loaded = module; } };
  const source = await fs.readFile(new URL('../src/client.js', import.meta.url), 'utf8');
  new Function('window', 'location', source)(window, { origin: 'http://localhost' });
  assert.equal(loaderCalls, 1, '必须执行实际客户端 loader');
  assert.equal(loaded.id, '@fegnze/dsh-capability-manager');
  const plugin = loaded.factory(id => {
    factoryCalls++;
    if (id === 'react') return React;
    throw Error(`未预期模块：${id}`);
  });
  assert.equal(factoryCalls, 1, 'factory只可读取共享React；禁止内部Harness模块依赖');
  assert.deepEqual(plugin.inject, ['slots', 'locale'], '通过实际模块导出验证注入契约');
  const ctx = new Context();
  const dicts = new Map();
  const registered = new Map();
  const snapshot = Object.freeze({ locale: 'zh' });
  ctx.provide('locale');
  ctx.set('locale', {
    register(ns, locale, value) { dicts.set(locale, value); return () => dicts.delete(locale); },
    bind: () => key => dicts.get('zh')?.[key] || key,
    subscribe: () => () => {}, getSnapshot: () => snapshot,
  });
  ctx.provide('layout');
  ctx.set('layout', { selectPanel(id) { if (failure === 'navigation') throw Error('PANEL_UNAVAILABLE'); navigations.push(id); } });
  ctx.provide('slots');
  ctx.set('slots', {
    inject(name, callback) { return callback(); },
    register(definition, component) { registered.set(definition.name, component); return () => registered.delete(definition.name); },
  });
  const fiber = ctx.plugin(plugin);
  for (let i = 0; i < 5; i++) await wait();
  assert.equal(typeof registered.get('main'), 'function', '真实 Cordis 激活必须注册主页面');
  assert.equal(typeof registered.get('sidebar.panellist'), 'function');
  const root = createRoot(document.getElementById('root'));
  const render = sessionId => root.render(React.createElement(registered.get(surface), { sessionId }));
  render('session-1');
  const settle = async () => { for (let i = 0; i < 12; i++) await wait(); };
  const find = (selector, label, parent = document) => [...parent.querySelectorAll(selector)].find(node => node.textContent.trim() === label || node.getAttribute('aria-label') === label);
  const click = async (label, parent = document) => {
    const node = find('button', label, parent);
    assert.ok(node, `找不到可点击按钮：${label}`);
    assert.equal(node.disabled, false, `按钮被禁用：${label}`);
    node.focus();
    node.dispatchEvent(new window.Event('click', { bubbles: true }));
    await settle();
  };
  const dialog = () => document.querySelector('[role="dialog"]');
  const capture = title => snapshots.push({ title, html: document.getElementById('root').innerHTML });
  await settle();
  const key = async (name, shiftKey = false) => { const event = new window.Event('keydown', { bubbles: true, cancelable: true }); Object.assign(event, { key: name, shiftKey }); document.activeElement.dispatchEvent(event); await settle(); return event; };
  try { await run({ window, document, requests, click, dialog, capture, settle, key, navigations, copied, render, nativeDialogs, mismatch: () => { mismatch = true; }, fail: action => { failure = action; }, delay: action => { delayedAction = action; }, release: () => { delayedAction = ''; releases.splice(0).forEach(resolve => resolve()); } }); }
  finally {
    root.unmount();
    await fiber.dispose();
    releases.splice(0).forEach(resolve => resolve());
    await settle();
    assert.equal(registered.size, 0, 'dispose释放所有插槽注册');
    assert.equal(nativeDialogs.filter(entry => entry.action === 'showModal').length, nativeDialogs.filter(entry => entry.action === 'close').length, '每个top-layer弹窗都随卸载关闭');
    const requestCount = requests.length;
    window.dispatchEvent(new window.Event('focus'));
    await settle();
    assert.equal(requests.length, requestCount, 'unmount释放窗口监听，不再请求');
    for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}

clientTest('真实 loader、Cordis 激活及 React DOM：项目详情、reveal、删除确认与失败保留', async () => fixture(async ({ document, requests, click, dialog, capture, fail }) => {
  assert.ok(document.querySelector('.dcm'));
  assert.ok(document.querySelector('style').textContent.includes('.dcm-card'));
  assert.ok(requests.some(request => request.action === 'list' && request.cwd === cwd));
  assert.ok(requests.some(request => request.action === 'local' && request.cwd === cwd));
  capture('项目级技能');
  await click('详情 · project-demo');
  assert.ok(dialog().textContent.includes('# 模拟技能'));
  assert.equal(requests.at(-1).action, 'detail');
  assert.equal(requests.at(-1).cwd, cwd);
  capture('技能详情');
  await click('打开文件夹', dialog());
  assert.deepEqual(Object.fromEntries(['method', 'action', 'rootId', 'path', 'cwd'].map(key => [key, requests.at(-1)[key]])), { method: 'POST', action: 'reveal', rootId: 'project-root', path: 'project-demo', cwd });
  assert.ok(dialog(), '打开目录之后保留详情');
  fail('preview');
  await click('删除', dialog());
  assert.ok(dialog().querySelector('[role="alert"]'));
  assert.ok(dialog().textContent.includes('# 模拟技能'), 'preview 失败保留详情');
  fail('');
  await click('删除', dialog());
  assert.equal(requests.at(-1).action, 'preview');
  assert.equal(requests.at(-1).operation, 'remove');
  assert.equal(requests.at(-1).cwd, cwd);
  assert.ok(dialog().textContent.includes(`${cwd}/.agents/skills/project-demo`));
  assert.equal(requests.filter(request => request.action === 'commit').length, 0, '确认前不提交');
  capture('删除确认');
  await click('取消', dialog());
  assert.ok(dialog().textContent.includes('# 模拟技能'));
  await click('删除', dialog());
  fail('commit');
  await click('删除', dialog());
  assert.ok(dialog().querySelector('[role="alert"]'));
  assert.ok(dialog().textContent.includes('删除此技能？'), 'commit 失败保留确认弹窗');
  const failedCommit = requests.at(-1);
  assert.equal(failedCommit.confirm, true);
  assert.equal(failedCommit.cwd, cwd);
  fail('');
  await click('删除', dialog());
  assert.equal(dialog(), null);
  assert.equal(document.querySelector('[aria-label="详情 · project-demo"]'), null, '成功提交后重新加载并移除旧技能行');
  assert.ok(requests.filter(request => request.action === 'list' && request.cwd === cwd).length >= 2);
  for (const request of requests) {
    assert.equal(request.credentials, 'same-origin');
    assert.equal(request.headers['x-dsh-capability-manager'], '1');
    if (request.method === 'POST') assert.equal(request.headers['content-type'], 'application/json');
  }
}));

clientTest('回收区只展示删除时间及文件，不展示原位置或恢复，purge 走显式确认', async () => fixture(async ({ document, requests, click, dialog, capture, fail }) => {
  const tab = [...document.querySelectorAll('.dcm-scopeTab')].find(node => node.textContent.startsWith('回收区'));
  tab.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(resolve => setImmediate(resolve));
  await click('old-demo删除时间 · ' + new Date('2026-10-22T08:00:00Z').toLocaleString());
  assert.equal(requests.at(-1).action, 'recoveryDetail');
  assert.equal(requests.at(-1).cwd, cwd);
  assert.equal(requests.at(-1).recoveryId, 'recovery-1');
  assert.ok(dialog().textContent.includes('删除时间'));
  assert.ok(dialog().textContent.includes('references/example.md'));
  assert.ok(!dialog().textContent.includes('MUST_NOT_DISPLAY'));
  assert.ok(!dialog().textContent.includes('原位置'));
  assert.ok(!dialog().textContent.includes('恢复'));
  assert.ok(!document.body.textContent.includes('不应显示的已清除条目'));
  capture('回收条目详情');
  fail('reveal');
  await click('打开文件夹', dialog());
  assert.equal(requests.at(-1).method, 'POST');
  assert.equal(requests.at(-1).recoveryId, 'recovery-1');
  assert.ok(dialog().querySelector('[role="alert"]'));
  fail('');
  await click('彻底删除', dialog());
  assert.equal(requests.at(-1).operation, 'purge');
  assert.equal(requests.at(-1).cwd, cwd);
  assert.equal(requests.filter(request => request.action === 'commit').length, 0);
  capture('回收条目彻底删除确认');
  await click('彻底删除', dialog());
  const commit = requests.find(request => request.action === 'commit');
  assert.equal(commit.confirm, true);
  assert.equal(commit.previewId, 'preview-purge');
  assert.equal(commit.cwd, cwd);
  assert.equal(dialog(), null);
  assert.ok(!document.body.textContent.includes('old-demo'));
}));

clientTest('本地文件较多时不显示本地文件页签，项目与全局详情操作仍可用', async () => fixture(async ({ document, requests, click, dialog, settle }) => {
  assert.equal(requests.filter(request => request.action === 'local' && request.cwd === cwd).length > 0, true);
  assert.equal(document.querySelectorAll('.dcm-scopeTab').length, 4);
  assert.equal([...document.querySelectorAll('.dcm-scopeTab')].some(node => node.textContent.startsWith('本地文件')), false);
  assert.equal(document.body.textContent.includes('draft-46.md'), false);

  await click('详情 · project-demo');
  assert.ok(dialog().textContent.includes('# 模拟技能'));
  assert.equal(requests.at(-1).action, 'detail');
  assert.equal(requests.at(-1).cwd, cwd);
  await click('打开文件夹', dialog());
  assert.equal(requests.at(-1).action, 'reveal');
  assert.equal(requests.at(-1).cwd, cwd);
  await click('关闭', dialog());

  const globalTab = [...document.querySelectorAll('.dcm-scopeTab')].find(node => node.textContent.startsWith('全局'));
  assert.ok(globalTab);
  globalTab.dispatchEvent(new window.Event('click', { bubbles: true }));
  await settle();
  await click('详情 · global-demo');
  assert.ok(dialog().textContent.includes('模拟全局技能'));
  assert.equal(requests.at(-1).action, 'detail');
  assert.equal(requests.at(-1).cwd, undefined);
  await click('打开文件夹', dialog());
  assert.equal(requests.at(-1).rootId, 'default-global');
  await click('删除', dialog());
  assert.equal(requests.at(-1).operation, 'remove');
  assert.equal(requests.at(-1).path, 'global-demo');
}));

clientTest('Cordis 4.0.5 官方同版本依赖与真实激活证据', context => {
  assert.equal(cordisVersion, '4.0.5');
  context.diagnostic(`实际执行 Cordis ${cordisVersion}：${cordis}；与桌面 ASAR 已核实版本一致，不代表桌面实例激活。`);
});

  clientTest('本地控件：文件请求忙时禁止导航和关闭，删除失败保留弹层', async () => fixture(async ({ window, document, requests, click, dialog, capture, settle, fail, delay, release, key }) => {
    await click('详情 · project-demo');
    assert.ok(dialog().querySelector('.dcm-detailDialog'));
    const commitsBeforeReveal = requests.filter(request => request.action === 'commit').length;
    await click('打开文件夹', dialog());
    assert.equal(requests.filter(request => request.action === 'commit').length, commitsBeforeReveal, 'reveal 绝不提交删除');
    delay('preview');
    const remove = [...dialog().querySelectorAll('button')].find(node => node.textContent === '删除');
    remove.dispatchEvent(new window.Event('click', { bubbles: true }));
    await settle();
    assert.equal(requests.at(-1).method, 'POST');
    assert.equal(requests.at(-1).cwd, cwd);
    for (const node of document.querySelectorAll('.dcm-scopeTab')) assert.equal(node.disabled, true, '忙时禁用 scope 导航');
    assert.equal(document.querySelector('.dcm-cardHead').disabled, true, '忙时禁用技能行');
    const mcpTab = [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'MCP');
    mcpTab.dispatchEvent(new window.Event('click', { bubbles: true }));
    await key('Escape');
    document.querySelector('.dcm-modal').dispatchEvent(new window.Event('click', { bubbles: true }));
    const close = [...dialog().querySelectorAll('button')].find(node => node.textContent === '关闭');
    close.dispatchEvent(new window.Event('click', { bubbles: true }));
    await settle();
    assert.ok(dialog().textContent.includes('# 模拟技能'), '忙时关闭、遮罩和主 tabs 不应关闭或切换详情');
    assert.equal(mcpTab.getAttribute('aria-selected'), 'false');
    release();
    await settle();
    assert.ok(dialog().textContent.includes('删除此技能？'));
    assert.ok(dialog().textContent.includes('删除后，此技能将不再从该位置加载。'));
    assert.ok(dialog().textContent.includes('/mock/project/.agents/skills/project-demo'));
    fail('commit');
    await click('删除', dialog());
    assert.ok(dialog().querySelector('[role="alert"]'), '失败保留确认 Modal 和错误反馈');
    assert.equal(requests.at(-1).confirm, true);
    assert.equal(requests.at(-1).cwd, cwd);
    capture('本地控件 · 删除失败保留弹层');
    fail('');
    await click('取消', dialog());
    await click('关闭', dialog());
    assert.equal(dialog(), null, '空闲时 onClose 可关闭正式/降级弹层');
  }));

clientTest('Modal 初始焦点、Tab 圈定、Escape 和焦点归还', async () => fixture(async ({ document, click, dialog, key }) => {
  const opener = document.querySelector('[aria-label="详情 · project-demo"]');
  await click('详情 · project-demo');
  assert.equal(document.activeElement.textContent, '关闭');
  const controls = [...dialog().querySelectorAll('button')];
  controls.at(-1).focus();
  const forward = await key('Tab');
  assert.equal(forward.defaultPrevented, true);
  assert.equal(document.activeElement, controls[0]);
  await key('Tab', true);
  assert.equal(document.activeElement, controls.at(-1));
  await key('Escape');
  assert.equal(dialog(), null);
  assert.equal(document.activeElement, opener);
}));

clientTest('Modal 顶层：底部变换容器内的选择和预览共用原生dialog', async () => fixture(async ({ document, click, dialog, nativeDialogs, mismatch }) => {
  const root = document.getElementById('root');
  root.style.cssText = 'position:fixed;bottom:0;transform:translateY(0);contain:layout paint;height:160px';
  mismatch();
  await click('选择助理');
  const modal = dialog();
  assert.equal(modal.localName, 'dialog');
  assert.equal(modal.hasAttribute('open'), true);
  assert.equal(nativeDialogs.filter(entry => entry.action === 'showModal').length, 1);
  assert.equal(root.contains(modal), true, '仍由组件拥有DOM；不向document.body注入节点');
  const body = modal.querySelector('.dcm-modalBody');
  assert.ok(body.textContent.includes('刷新'));
  assert.equal(modal.querySelector('.dcm-modalHead').parentElement, body.parentElement);
  await click('选择助理 · 插件开发');
  assert.equal(dialog(), modal, '切换到预览不退出top layer');
  assert.equal(nativeDialogs.filter(entry => entry.action === 'showModal').length, 1);
  assert.ok(body.querySelector('textarea'));
  assert.ok(body.textContent.includes('复制接续提示'));
  assert.ok(body.textContent.includes('确认选择'));
  assert.equal(body.contains(modal.querySelector('.dcm-modalHead')), false, '头部不随内容滚出');
  await click('关闭');
  assert.equal(nativeDialogs.filter(entry => entry.action === 'close').length, 1);
  assert.equal(dialog(), null);
}, { surface: 'conversation.input.left' }));

clientTest('Modal 顶层：短窄视口使用动态视口约束和独立内容滚动', async () => fixture(async ({ document, click, dialog }) => {
  await click('详情 · project-demo');
  const css = document.querySelector('style').textContent;
  const rule = selector => {
    const start = css.indexOf(`${selector}{`);
    assert.ok(start >= 0, `缺少布局规则 ${selector}`);
    return css.slice(start, css.indexOf('}', start) + 1);
  };
  assert.match(rule('.dcm-modal.dcm-modal'), /position:fixed;inset:0/);
  assert.match(rule('.dcm-modal.dcm-modal'), /height:100vh;height:100dvh/);
  assert.match(rule('.dcm-modal.dcm-modal'), /max-width:none;max-height:none;margin:0/);
  assert.match(rule('.dcm-modal>.dcm-detailDialog'), /max-height:100%;overflow:hidden/);
  assert.match(rule('.dcm-modalBody'), /min-height:0;overflow:auto;overscroll-behavior:contain/);
  assert.match(rule('.dcm-modalHead'), /flex:none/);
  assert.match(rule('.dcm-modal::backdrop'), /var\(--dsw-alias-bg-mask-1\)/);
  assert.ok(css.includes('@media(max-width:640px),(max-height:480px)'));
  assert.match(rule('.dcm-modal>.dcm-detailDialog'), /background:var\(--dsw-alias-bg-layer-1\)/);
  assert.ok(dialog().querySelector('.dcm-modalBody').textContent.includes('删除'));
}));

clientTest('Modal 顶层：native cancel忙时禁止，空闲关闭并归还焦点', async () => fixture(async ({ window, document, click, dialog, delay, release, settle, nativeDialogs }) => {
  const opener = document.querySelector('[aria-label="详情 · project-demo"]');
  await click('详情 · project-demo');
  delay('preview');
  const remove = [...dialog().querySelectorAll('button')].find(node => node.textContent === '删除');
  remove.dispatchEvent(new window.Event('click', { bubbles: true }));
  await settle();
  const busyCancel = new window.Event('cancel', { cancelable: true });
  dialog().dispatchEvent(busyCancel);
  await settle();
  assert.equal(busyCancel.defaultPrevented, true);
  assert.ok(dialog());
  assert.equal(nativeDialogs.filter(entry => entry.action === 'close').length, 0);
  release();
  await settle();
  const idleCancel = new window.Event('cancel', { cancelable: true });
  dialog().dispatchEvent(idleCancel);
  await settle();
  assert.equal(idleCancel.defaultPrevented, true, '由React卸载而非浏览器单独关闭');
  assert.equal(dialog(), null);
  assert.equal(document.activeElement, opener);
  assert.equal(nativeDialogs.filter(entry => entry.action === 'close').length, 1);
}));

clientTest('Skills/MCP 行为保持：连接检测、开关、删除与外部只读', async () => fixture(async ({ document, requests, click, dialog }) => {
  await click('MCP');
  assert.equal(document.querySelectorAll('[role="switch"]').length, 1);
  await click('详情 · managed');
  assert.ok(dialog().textContent.includes('可连接'));
  assert.ok(dialog().textContent.includes('mcp__managed__tool'));
  assert.equal(requests.at(-1).action, 'check');
  await click('关闭');
  await click('managed');
  const toggle = requests.find(request => request.action === 'toggle');
  assert.equal(toggle.enabled, false);
  assert.equal(toggle.revision, 'mcp-revision');
  await click('删除 · managed');
  assert.ok(requests.some(request => request.action === 'remove' && request.confirm));
  const checks = requests.filter(request => request.action === 'check').length;
  await click('详情 · external');
  assert.ok(dialog().textContent.includes('只读服务，未做探测'));
  assert.equal(requests.filter(request => request.action === 'check').length, checks);
}));

clientTest('第三页签显示助理就绪及精确身份；安装管理只跳官方页面', async () => fixture(async ({ document, click, dialog, requests, navigations, fail }) => {
  assert.equal(document.querySelector('.dcm-title').textContent, '技能 • MCP • 助理');
  const tabs = [...document.querySelector('.dcm-tabs').querySelectorAll('[role="tab"]')];
  assert.deepEqual(tabs.map(node => node.textContent), ['技能', 'MCP', '助理']);
  await click('助理');
  assert.ok(requests.some(request => request.tab === 'assistants' && request.action === 'list'));
  await click('安装助理');
  assert.deepEqual(navigations, ['plugins']);
  await click('详情 · 插件开发');
  assert.ok(dialog().textContent.includes('@fegnze/dsh-assistant-plugin-dev'));
  assert.ok(dialog().textContent.includes('a'.repeat(64)));
  assert.ok(dialog().textContent.includes('就绪'));
  await click('在插件管理中管理');
  assert.deepEqual(navigations, ['plugins', 'plugins']);
  fail('navigation');
  await click('在插件管理中管理');
  assert.ok(dialog().querySelector('[role="alert"]').textContent.includes('PANEL_UNAVAILABLE'));
  assert.equal(requests.some(request => ['install', 'remove', 'bind'].includes(request.action)), false);
}));

clientTest('输入框预览不选择预设；明确确认绑定后仅显示状态和详情', async () => fixture(async ({ document, requests, click, dialog }) => {
  await click('选择助理');
  await click('选择助理 · 插件开发');
  assert.ok(dialog().textContent.includes('首次任务前将选择所需预设'));
  assert.equal(requests.filter(request => request.action === 'bind').length, 0);
  assert.equal(requests.at(-1).action, 'previewBind');
  assert.equal(requests.at(-1).method, 'POST');
  await click('确认选择');
  const bind = requests.find(request => request.action === 'bind');
  assert.deepEqual({ sessionId: bind.sessionId, id: bind.id, revision: bind.revision, confirm: bind.confirm }, { sessionId: 'session-1', id: 'plugin-development', revision: 'receipt-1', confirm: true });
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'bound');
  assert.ok(dialog().textContent.includes('已启用'));
  assert.equal(dialog().textContent.includes('确认选择'), false);
  assert.equal(dialog().textContent.includes('切换'), false);
  assert.equal(dialog().textContent.includes('解绑'), false);
  assert.equal(dialog().textContent.includes('默认助理'), false);
  await click('关闭');
  await click('插件开发 · 已启用');
  assert.ok(dialog().textContent.includes('校验'));
}, { surface: 'conversation.input.left' }));

clientTest('不匹配预设保留blocked选择，提示可复制，复制失败可手动取文', async () => fixture(async ({ document, requests, click, dialog, mismatch, copied, fail }) => {
  mismatch();
  await click('选择助理');
  await click('选择助理 · 插件开发');
  assert.ok(dialog().textContent.includes('当前无法启用'));
  await click('确认选择');
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'blocked');
  assert.ok(dialog().textContent.includes('PRESET_MISMATCH'));
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  fail('copy');
  await click('复制接续提示');
  assert.ok(dialog().textContent.includes('复制失败，请手动复制'));
  assert.ok(dialog().querySelector('textarea').value.includes('在新会话选择插件开发助理'));
  fail('');
  await click('复制接续提示');
  assert.equal(copied.length, 1);
  assert.ok(dialog().textContent.includes('已复制'));
}, { surface: 'conversation.input.left' }));

clientTest('输入框绑定失败刷新Host状态、不自动重提；切会话忽略旧请求', async () => fixture(async ({ document, requests, click, dialog, delay, release, settle, fail, render }) => {
  await click('选择助理');
  await click('选择助理 · 插件开发');
  fail('bind');
  await click('确认选择');
  assert.ok(dialog().querySelector('[role="alert"]').textContent.includes('MOCK_FAILURE'));
  assert.equal(requests.at(-1).action, 'binding');
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  await click('关闭');
  fail('');
  delay('binding');
  render('session-2');
  await settle();
  render('session-3');
  await settle();
  release();
  await settle();
  assert.ok(requests.some(request => request.action === 'binding' && request.sessionId === 'session-3'));
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'unbound');
}, { surface: 'conversation.input.left' }));

clientTest('预览不允许选择时确认不可用，不能误落绑定', async () => fixture(async ({ document, requests, click, dialog }) => {
  await click('选择助理');
  await click('选择助理 · 插件开发');
  const confirm = [...dialog().querySelectorAll('button')].find(node => node.textContent === '确认选择');
  assert.equal(confirm.disabled, true);
  confirm.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(requests.some(request => request.action === 'bind'), false);
  await click('取消');
  assert.ok(document.querySelector('[aria-label="选择助理 · 插件开发"]'));
}, { surface: 'conversation.input.left', canSelect: false }));

clientTest('状态读取失败可恢复且不得继续显示已启用', async () => fixture(async ({ document, requests, click, dialog, fail, settle, window }) => {
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'unavailable');
  fail('');
  await click('助理 · 不可用');
  assert.ok(dialog().textContent.includes('PRESET_MISMATCH'));
  await click('关闭');
  fail('binding');
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'unavailable');
  fail('');
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'blocked');
}, { surface: 'conversation.input.left', assistantPhase: 'blocked', initialFailure: 'binding' }));

clientTest('缺失已绑定包时保留blocked身份和接续提示，不展示助理选择', async () => fixture(async ({ document, click, dialog }) => {
  await click('plugin-development · 已阻断');
  assert.ok(dialog().querySelector('[role="alert"]').textContent.includes('MOCK_FAILURE'));
  assert.ok(dialog().textContent.includes('@fegnze/dsh-assistant-plugin-dev'));
  assert.ok(dialog().querySelector('textarea').value.includes('在新会话'));
  assert.equal(document.querySelector('[aria-label="选择助理 · 插件开发"]'), null);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked', initialFailure: 'detail' }));

clientTest('助理配置问题显示就绪状态和必要补救操作', async () => fixture(async ({ document, click, dialog }) => {
  await click('助理');
  assert.ok(document.body.textContent.includes('待配置'));
  await click('详情 · 插件开发');
  assert.ok(dialog().textContent.includes('缺少配置'));
  assert.ok(dialog().textContent.includes('请设置配置路径'));
}, { assistantStatus: 'configuration-required' }));

clientTest('精确重试：blocked同身份预览后显式确认恢复，不隐式重提', async () => fixture(async ({ window, document, requests, click, dialog, settle }) => {
  await click('plugin-development · 已阻断');
  assert.equal(requests.some(request => request.action === 'previewBind' || request.action === 'bind'), false);
  await click('重试');
  assert.equal(requests.at(-1).action, 'previewBind');
  assert.equal(requests.at(-1).id, 'plugin-development');
  assert.ok(dialog().textContent.includes('确认重试'));
  assert.equal(requests.some(request => request.action === 'bind'), false);
  assert.equal(document.querySelector('[aria-label="选择助理 · 插件开发"]'), null);
  await click('取消');
  assert.equal(dialog().textContent.includes('确认重试'), false);
  assert.ok(dialog().textContent.includes('PRESET_MISMATCH'));
  await click('重试');
  await click('确认重试');
  const binds = requests.filter(request => request.action === 'bind');
  assert.equal(binds.length, 1);
  assert.equal(binds[0].revision, 'receipt-2');
  assert.equal(binds[0].confirm, true);
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'bound');
  assert.equal([...dialog().querySelectorAll('button')].some(node => node.textContent === '重试'), false);
  await click('关闭');
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked' }));

for (const [field, value] of Object.entries({ assistantId: 'another-assistant', packageName: '@example/other', packageVersion: '0.2.0', contentDigest: 'b'.repeat(64), requiredPreset: 'other-preset' })) {
  clientTest(`精确重试：${field}漂移拒绝确认并保留原绑定`, async () => fixture(async ({ document, requests, click, dialog }) => {
    await click('plugin-development · 已阻断');
    await click('重试');
    assert.ok(dialog().textContent.includes('助理身份已变化，不能在此会话重试。请新建会话。'));
    assert.ok(dialog().textContent.includes('ASSISTANT_IDENTITY_CHANGED'));
    assert.ok(dialog().textContent.includes('a'.repeat(64)), '原身份仍可见');
    assert.equal(dialog().textContent.includes('确认重试'), false);
    assert.equal(requests.some(request => request.action === 'bind'), false);
    assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'blocked');
  }, { surface: 'conversation.input.left', assistantPhase: 'blocked', previewIdentity: { [field]: value } }));
}

clientTest('精确重试：缺包显示明确反馈和接续提示，不隐式提交', async () => fixture(async ({ document, requests, click, dialog, window, settle }) => {
  await click('plugin-development · 已阻断');
  await click('重试');
  assert.ok(dialog().textContent.includes('助理包不可用，请在插件管理中检查原版本。'));
  assert.ok(dialog().textContent.includes('ASSISTANT_NOT_FOUND'));
  assert.ok(dialog().querySelector('textarea').value.includes('在新会话'));
  assert.equal(dialog().textContent.includes('确认重试'), false);
  assert.equal(requests.filter(request => request.action === 'previewBind').length, 1);
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(requests.filter(request => request.action === 'previewBind').length, 1);
  assert.equal(requests.some(request => request.action === 'bind'), false);
  assert.equal(document.querySelector('[aria-label="选择助理 · 插件开发"]'), null);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked', missingPackage: true }));

clientTest('精确重试：确认失败必须重新预览，不自动重提旧receipt', async () => fixture(async ({ requests, click, dialog, fail, window, settle }) => {
  await click('plugin-development · 已阻断');
  await click('重试');
  fail('bind');
  await click('确认重试');
  assert.ok(dialog().textContent.includes('MOCK_FAILURE'));
  assert.equal(dialog().textContent.includes('确认重试'), false);
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  fail('');
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  await click('重试');
  assert.equal(requests.at(-1).action, 'previewBind');
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked' }));

clientTest('精确重试：确认及状态读取同时失败也丢弃旧receipt', async () => fixture(async ({ requests, click, dialog, fail, window, settle }) => {
  await click('plugin-development · 已阻断');
  await click('重试');
  fail(['bind', 'binding']);
  await click('确认重试');
  assert.equal(dialog().textContent.includes('确认重试'), false);
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  fail('');
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(dialog().textContent.includes('确认重试'), false);
  assert.equal(requests.filter(request => request.action === 'bind').length, 1);
  await click('重试');
  assert.equal(requests.filter(request => request.action === 'previewBind').length, 2);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked' }));

clientTest('输入框已有blocked身份不能重新选择，窗口重新激活刷新状态', async () => fixture(async ({ window, document, requests, click, dialog, settle }) => {
  assert.equal(document.querySelector('.dcm-composerButton').getAttribute('data-phase'), 'blocked');
  const before = requests.length;
  window.dispatchEvent(new window.Event('focus'));
  await settle();
  assert.equal(requests.length, before + 1);
  await click('plugin-development · 已阻断');
  assert.ok(dialog().textContent.includes('PRESET_MISMATCH'));
  assert.equal(dialog().textContent.includes('确认选择'), false);
  assert.equal(document.querySelector('[aria-label="选择助理 · 插件开发"]'), null);
}, { surface: 'conversation.input.left', assistantPhase: 'blocked' }));
