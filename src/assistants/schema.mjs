import { z } from 'zod';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';

export class AssistantError extends Error {
  constructor(code, status = 400) { super(code); this.name = 'AssistantError'; this.code = code; this.status = status; }
}
export const fail = (code, status) => { throw new AssistantError(code, status); };
const text = z.string().min(1).max(4096);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128);
const packageSchema = z.object({ name: text, version: text, contentDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const manifestSchema = z.object({
  schemaVersion: z.literal(1), id, name: text, description: text,
  package: packageSchema,
  requires: z.object({ agentPreset: text.optional() }).strict().optional(),
  capabilities: z.array(z.object({ id, title: text, description: text }).strict()).max(100),
}).strict();
export const issueSchema = z.object({ code: text, message: text, capability: text.optional(), remediation: text.optional() }).strict();
export const readinessSchema = z.object({ status: z.enum(['ready', 'configuration-required', 'incompatible', 'unavailable']), issues: z.array(issueSchema).max(100) }).strict();
export const identitySchema = z.object({
  assistantId: id, packageName: text, packageVersion: text,
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/), requiredPreset: text.nullable(),
}).strict();
export const bindingSchema = z.object({
  schemaVersion: z.literal(1), sessionId: text, selectionId: text,
  identity: identitySchema, revision: z.number().int().positive(),
  phase: z.enum(['preparing', 'bound', 'blocked']), reason: text.nullable(), boundAt: z.number().int().nonnegative(),
}).strict();
export const domainSpec = defineDomain({
  name: 'dsh_assistants', version: 1, tables: { bindings: { valueSchema: bindingSchema } },
});
/** Reject JSON impostors before cloning, including accessors (never invoke them). */
export function jsonValue(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) fail('INVALID_DECLARATION');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('INVALID_DECLARATION');
  seen.add(value);
  const output = Array.isArray(value) ? [] : {};
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value) && keys.length !== value.length + 1) fail('INVALID_DECLARATION');
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string' || key === '__proto__') fail('INVALID_DECLARATION');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('INVALID_DECLARATION');
    output[key] = jsonValue(descriptor.value, seen);
  }
  seen.delete(value);
  return output;
}
export function frozen(value) {
  if (value && typeof value === 'object') { for (const nested of Object.values(value)) frozen(nested); Object.freeze(value); }
  return value;
}
export function parseManifest(input) {
  const result = manifestSchema.safeParse(jsonValue(input));
  if (!result.success || new Set(result.data.capabilities.map(row => row.id)).size !== result.data.capabilities.length) fail('INVALID_DECLARATION');
  return frozen(result.data);
}
export const identityOf = manifest => ({ assistantId: manifest.id, packageName: manifest.package.name, packageVersion: manifest.package.version, contentDigest: manifest.package.contentDigest, requiredPreset: manifest.requires?.agentPreset ?? null });
export const sameIdentity = (a, b) => !!a && !!b && ['assistantId','packageName','packageVersion','contentDigest','requiredPreset'].every(key => a[key] === b[key]);
export const issue = code => ({ code, message: code.replaceAll('_', ' ').toLowerCase() });
export const continuation = (identity, cwd = null) => identity ? `请在这个新建会话中接续下列任务。\n助理：${identity.assistantId}\n实现：${identity.packageName}@${identity.packageVersion}\n内容身份：${identity.contentDigest}\n原生预设：${identity.requiredPreset ?? '不额外指定'}\n工作目录：${cwd ?? '尚未提供，请先确认'}\n\n开始前请由我通过助理选择控件完成绑定；不要擅自改权限、认证或发布。当前提示不包含旧会话历史。\n待续目标：【粘贴你的当前目标】\n必要上下文与已完成步骤：【仅补充任务所需内容】\n请先核对上述事实和助理就绪状态，再从未完成部分继续。` : null;
export const sessionKey = value => { if (typeof value !== 'string' || !value || value.length > 256) fail('INVALID_SESSION'); return value; };
export function onceAsync(action) {
  let promise;
  return () => {
    if (!promise) {
      // Call the revocation prefix synchronously, not in a deferred microtask.
      try { promise = Promise.resolve(action()); } catch (error) { promise = Promise.reject(error); }
    }
    return promise;
  };
}
