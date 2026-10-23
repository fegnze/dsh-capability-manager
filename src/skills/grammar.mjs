import { parseDocument } from 'yaml';
import { ManagerError } from '../errors.mjs';
const boolean = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && (value === 0 || value === 1)) return !!value;
  if (typeof value === 'string' && /^(true|false|yes|no|on|off|1|0)$/i.test(value)) return /^(true|yes|on|1)$/i.test(value);
  throw new ManagerError('INVALID_INVOCATION');
};
export function validateRaw(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1024*1024 || raw.includes('\0')) throw new ManagerError('INVALID_SKILL');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) throw new ManagerError('MISSING_FRONTMATTER');
  let meta;
  try { const doc=parseDocument(match[1],{uniqueKeys:true}); if(doc.errors.length) throw Error(); meta=doc.toJS({maxAliasCount:50}); } catch { throw new ManagerError('INVALID_FRONTMATTER'); }
  if (!meta || typeof meta!=='object' || Array.isArray(meta) || typeof meta.name!=='string' || meta.name.length>128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.name) || typeof meta.description!=='string' || !meta.description.trim()) throw new ManagerError('INVALID_SKILL');
  if (meta.whenToUse !== undefined && typeof meta.whenToUse !== 'string') throw new ManagerError('INVALID_SKILL');
  return {name:meta.name,description:meta.description,invocation:{modelInvocable:!boolean(meta['disable-model-invocation'],false),userInvocable:boolean(meta['user-invocable'],true)}};
}
