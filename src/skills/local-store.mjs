import * as nodeFs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ManagerError } from '../errors.mjs';

export class LocalStoreError extends ManagerError {
  constructor(code) { super(code); }
}
const execute = promisify(execFile);
const trashScript = 'on run argv\nset targets to {}\nrepeat with filename in argv\nset end of targets to POSIX file (contents of filename) as alias\nend repeat\ntell application "Finder" to delete targets\nend run';
export async function finderTrash(paths, run = execute) {
  await run('/usr/bin/osascript', ['-e', trashScript, '--', ...paths], { timeout: 30000, maxBuffer: 65536 });
}
const fail = code => { throw new LocalStoreError(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = stat => `${stat.dev}:${stat.ino}`;
const stamp = stat => `${identity(stat)}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
const contains = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);
const key = name => name.normalize('NFC').toLocaleLowerCase('en-US');
const segment = name => {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || /[\x00-\x1f\x7f]/.test(name) || name.length > 200 || name.endsWith('.') || name.endsWith(' ')) fail('INVALID_OBJECT');
  return name;
};
const safeId = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) fail('INVALID_RECOVERY'); return value; };

/**
 * macOS owner-local cooperative adapter, NOT a hostile same-user race boundary.
 * No shell, no arbitrary mutations. Roots are explicitly granted by the caller.
 * authorize must validate a one-use owner grant bound to the returned preview.
 * createFlat must use native fs.writeText(createIfAbsent); omission fails closed.
 */
export async function createLocalStore({ roots = [], validateRaw, authorize = async () => false, createFlat, fs = nodeFs,
  platform = process.platform, uid = process.getuid?.(), now = Date.now,
  limits = {}, trash = finderTrash, open = async (target, { folder = false } = {}) => execute('/usr/bin/open', folder ? [target] : ['-R', target], { timeout: 30000, maxBuffer: 65536 }),
  mapPath = value => value } = {}) {
  if (platform !== 'darwin') fail('CAPABILITY_UNAVAILABLE');
  if (typeof validateRaw !== 'function') fail('VALIDATOR_REQUIRED');
  const cap = { files: 512, bytes: 32 * 1024 * 1024, fileBytes: 8 * 1024 * 1024, depth: 12, ttlMs: 5 * 60 * 1000, ...limits };
  for (const value of Object.values(cap)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMITS');
  const rootMap = new Map();
  const previews = new Map();
  const busy = new Set();
  async function statOrNone(p) { try { return await fs.lstat(p); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; } }
  async function chain(p) {
    if (!path.isAbsolute(p) || path.resolve(p) !== p) fail('INVALID_PATH');
    let cursor = path.parse(p).root;
    const result = [];
    for (const part of p.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      const s = await fs.lstat(cursor);
      if (!s.isDirectory() || s.isSymbolicLink()) fail('UNSAFE_ANCESTOR');
      result.push([cursor, identity(s)]);
    }
    return result;
  }
  async function verifyRoot(root) {
    const checks = [...root.chain, ...root.stateChain];
    for (const [p, expected] of checks) {
      const s = await fs.lstat(p);
      if (!s.isDirectory() || s.isSymbolicLink() || identity(s) !== expected) fail('ROOT_CHANGED');
    }
    if ((await fs.lstat(root.path)).uid !== uid || (await fs.lstat(root.state)).uid !== uid) fail('ROOT_NOT_OWNED');
  }
  function getRoot(id) { const root = rootMap.get(id); if (!root) fail('ROOT_UNAUTHORIZED'); return root; }
  for (const config of roots) {
    if (!config?.trusted || typeof config.id !== 'string' || !config.id || rootMap.has(config.id)) fail('ROOT_UNAUTHORIZED');
    if (typeof config.path !== 'string' || !path.isAbsolute(config.path)) fail('INVALID_PATH');
    const p = path.resolve(config.path);
    const ancestry = await chain(p);
    const stat = await fs.lstat(p);
    if (stat.uid !== uid) fail('ROOT_NOT_OWNED');
    const state = path.join(path.dirname(p), `.dsh-capability-manager-${path.basename(p)}-state`);
    for (const other of roots) {
      if (typeof other?.path !== 'string') fail('INVALID_PATH');
      const candidate = path.resolve(other.path);
      if (contains(candidate, state) || contains(state, candidate)) fail('STATE_DISCOVERY_CONFLICT');
    }
    for (const other of rootMap.values()) if (contains(other.path, p) || contains(p, other.path) || other.state === state) fail('ROOT_OVERLAP');
    if (!await statOrNone(state)) {
      try { await fs.mkdir(state, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    const stateStat = await fs.lstat(state);
    if (!stateStat.isDirectory() || stateStat.isSymbolicLink() || stateStat.uid !== uid || stateStat.dev !== stat.dev || (stateStat.mode & 0o077)) fail('UNSAFE_STATE');
    rootMap.set(config.id, { id: config.id, path: p, state, chain: ancestry, stateChain: await chain(state), dev: stat.dev });
  }
  async function readFile(p, stat) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_FILE');
    if (stat.size > cap.fileBytes) fail('LIMIT_EXCEEDED');
    const h = await fs.open(p, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (stamp(await h.stat()) !== stamp(stat)) fail('OBJECT_CHANGED');
      // Fixed bound even when a non-cooperative writer grows the file mid-read.
      const buffer = Buffer.alloc(cap.fileBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = await h.read(buffer, length, buffer.length - length, null);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      const bytes = buffer.subarray(0, length);
      if (bytes.length > cap.fileBytes || stamp(await h.stat()) !== stamp(stat)) fail('OBJECT_CHANGED');
      if (stamp(await fs.lstat(p)) !== stamp(stat)) fail('OBJECT_CHANGED');
      return bytes;
    } finally { await h.close(); }
  }
  async function scan(p) {
    const rows = []; let total = 0;
    const top = await fs.lstat(p);
    if (top.isSymbolicLink()) fail('SYMLINK_FORBIDDEN');
    const directory = top.isDirectory();
    if (!directory && !top.isFile()) fail('SPECIAL_FILE');
    let instruction;
    async function walk(current, relative, depth) {
      if (depth > cap.depth || rows.length >= cap.files) fail('LIMIT_EXCEEDED');
      const s = await fs.lstat(current);
      if (s.isSymbolicLink()) fail('SYMLINK_FORBIDDEN');
      if (s.isDirectory()) {
        rows.push({ relative, type: 'directory', mode: s.mode & 0o777, version: stamp(s) });
        const names = (await fs.readdir(current)).sort();
        const seen = new Set();
        for (const name of names) {
          segment(name);
          if (seen.has(key(name))) fail('NAME_COLLISION');
          seen.add(key(name));
          const child = relative ? `${relative}/${name}` : name;
          if (child !== 'SKILL.md' && name.toLowerCase() === 'skill.md') fail('AMBIGUOUS_SKILL');
          await walk(path.join(current, name), child, depth + 1);
        }
        if (stamp(await fs.lstat(current)) !== stamp(s)) fail('OBJECT_CHANGED');
      } else {
        if (!s.isFile()) fail('SPECIAL_FILE');
        const bytes = await readFile(current, s);
        total += bytes.length;
        if (total > cap.bytes) fail('LIMIT_EXCEEDED');
        rows.push({ relative, type: 'file', mode: s.mode & 0o777, size: bytes.length, digest: hash(bytes), version: stamp(s) });
        if ((!directory && relative === '') || relative === 'SKILL.md') instruction = bytes;
      }
    }
    await walk(p, '', 0);
    if (!instruction) fail('SKILL_FILE_REQUIRED');
    let raw;
    try { raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(instruction); } catch { fail('INVALID_UTF8'); }
    const metadata = await validateRaw(raw);
    const digest = hash(JSON.stringify(rows.map(({ version, ...row }) => row)));
    const versionDigest = hash(JSON.stringify(rows));
    return { kind: directory ? 'directory' : 'flat', inventory: rows, digest, versionDigest, totalBytes: total, metadata, raw, identity: identity(top) };
  }
  async function absent(root, object) {
    segment(object);
    for (const entry of await fs.readdir(root.path)) if (key(entry) === key(object)) fail('TARGET_EXISTS');
  }
  async function locked(root, operation) {
    if (busy.has(root.id)) fail('ROOT_BUSY');
    busy.add(root.id);
    const lock = path.join(root.state, 'lock'); let own;
    try {
      await verifyRoot(root);
      if (await statOrNone(lock)) fail('ROOT_BUSY');
      try { await fs.mkdir(lock, { mode: 0o700 }); } catch (e) { if (e.code === 'EEXIST') fail('ROOT_BUSY'); throw e; }
      own = identity(await fs.lstat(lock));
      return await operation();
    } finally {
      if (own) {
        const s = await statOrNone(lock);
        if (s?.isDirectory() && identity(s) === own) await fs.rmdir(lock);
      }
      busy.delete(root.id);
    }
  }
  async function manifest(container, value) {
    const temporary = path.join(container, `manifest-${randomUUID()}.tmp`);
    const h = await fs.open(temporary, 'wx', 0o600);
    try { await h.writeFile(JSON.stringify(value)); await h.sync(); } finally { await h.close(); }
    await fs.rename(temporary, path.join(container, 'manifest.json'));
  }
  function publishPreview(data) {
    const preview = { ...data, id: randomUUID(), expiresAt: now() + cap.ttlMs };
    previews.set(preview.id, structuredClone(preview));
    return structuredClone(preview);
  }
  async function consume(id, authorization, operation) {
    const p = previews.get(id);
    if (!p || p.operation !== operation || p.expiresAt < now()) fail('PREVIEW_EXPIRED');
    if (!await authorize({ preview: structuredClone(p), authorization })) fail('OWNER_APPROVAL_REQUIRED');
    if (previews.get(id) !== p) fail('PREVIEW_CONSUMED');
    previews.delete(id);
    return p;
  }
  async function reserve(root, object) {
    await absent(root, object);
    const destination = path.join(root.path, object);
    await fs.mkdir(destination, { mode: 0o700 });
    return { destination, identity: identity(await fs.lstat(destination)) };
  }
  async function verifyReservation(r) {
    const s = await fs.lstat(r.destination);
    if (!s.isDirectory() || s.isSymbolicLink() || identity(s) !== r.identity || (await fs.readdir(r.destination)).length) fail('RESERVATION_CHANGED');
  }
  async function copy(source, destination, snapshot) {
    for (const row of snapshot.inventory) {
      const src = row.relative ? path.join(source, row.relative) : source;
      const dst = row.relative ? path.join(destination, row.relative) : destination;
      if (row.type === 'directory') await fs.mkdir(dst, { mode: 0o700 });
      else {
        const s = await fs.lstat(src);
        if (stamp(s) !== row.version) fail('OBJECT_CHANGED');
        const bytes = await readFile(src, s);
        if (hash(bytes) !== row.digest) fail('OBJECT_CHANGED');
        await fs.writeFile(dst, bytes, { flag: 'wx', mode: 0o600 });
        await fs.chmod(dst, row.mode & 0o777);
      }
    }
    // Apply directory modes last so restrictive sources do not prevent staging.
    for (const row of [...snapshot.inventory].reverse()) if (row.type === 'directory') {
      await fs.chmod(row.relative ? path.join(destination, row.relative) : destination, row.mode & 0o777);
    }
  }
  async function readRecord(root, recoveryId) {
    safeId(recoveryId);
    await verifyRoot(root);
    const container = path.join(root.state, recoveryId);
    await chain(container);
    const p = path.join(container, 'manifest.json');
    const bytes = await readFile(p, await fs.lstat(p));
    let record; try { record = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_RECOVERY'); }
    if (record.id !== recoveryId || record.rootId !== root.id || record.rootIdentity !== root.chain.at(-1)[1] || !['remove', 'import'].includes(record.operation)) fail('INVALID_RECOVERY');
    segment(record.object ?? record.name);
    if (!record.name) record.name = record.object;
    return { container, record };
  }
  async function recoveryStatus(container, record) {
    const object = await statOrNone(path.join(container, 'object'));
    if (record.operation === 'import') return record.status === 'committed' ? 'committed' : 'needs-reconciliation';
    if (['trashed', 'purged'].includes(record.status) && !object) return record.status;
    if (record.status === 'restored' && !object) return 'restored';
    // Recovery is a file fallback: malformed or changed skill content must not
    // make the record disappear or block listing/cleanup decisions.
    if (record.status === 'committed' && object && !object.isSymbolicLink() && (object.isFile() || object.isDirectory())) return 'available';
    return 'needs-reconciliation';
  }
  async function boundedPayload(target) {
    const top = await fs.lstat(target);
    if (top.isSymbolicLink() || (!top.isFile() && !top.isDirectory())) fail('UNSAFE_FILE');
    const rows = []; let totalBytes = 0; let raw;
    async function walk(current, relative, depth) {
      if (depth > cap.depth || rows.length >= cap.files) fail('LIMIT_EXCEEDED');
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) fail('SYMLINK_FORBIDDEN');
      if (stat.isDirectory()) {
        rows.push({ relative, type: 'directory', mode: stat.mode & 0o777, version: stamp(stat) });
        for (const name of (await fs.readdir(current)).sort()) { segment(name); await walk(path.join(current, name), relative ? `${relative}/${name}` : name, depth + 1); }
        if (stamp(await fs.lstat(current)) !== stamp(stat)) fail('OBJECT_CHANGED');
      } else if (stat.isFile()) {
        if (stat.size > cap.fileBytes) fail('LIMIT_EXCEEDED');
        const bytes = await readFile(current, stat);
        rows.push({ relative, type: 'file', mode: stat.mode & 0o777, size: bytes.length, digest: hash(bytes), version: stamp(stat) });
        totalBytes += bytes.length; if (totalBytes > cap.bytes) fail('LIMIT_EXCEEDED');
        if (relative === 'SKILL.md' || (relative === '' && top.isFile())) raw = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes);
      } else fail('SPECIAL_FILE');
    }
    await walk(target, '', 0);
    return { kind: top.isDirectory() ? 'directory' : 'flat', inventory: rows, raw, totalBytes, identity: identity(top), digest: hash(JSON.stringify(rows.map(({ version, ...row }) => row))), versionDigest: hash(JSON.stringify(rows)) };
  }
  async function recoveryPayload(container, item = 'object') {
    const target = path.join(container, item);
    return boundedPayload(target);
  }
  return {
    async inventory({ rootId }) {
      const root = getRoot(rootId); await verifyRoot(root);
      const result = [];
      for (const object of (await fs.readdir(root.path)).sort()) {
        try { segment(object); const s = await fs.lstat(path.join(root.path, object));
          if (!s.isDirectory() && !object.endsWith('.md') && !s.isSymbolicLink()) continue;
          const data = await scan(path.join(root.path, object));
          result.push({ rootId, object, ...data, raw: undefined, readOnly: false });
        } catch (e) { result.push({ rootId, object, readOnly: true, error: e.code ?? 'READ_FAILED' }); }
      }
      return result;
    },
    async raw({ rootId, object }) {
      const root = getRoot(rootId); segment(object); await verifyRoot(root);
      return { rootId, object, ...await scan(path.join(root.path, object)) };
    },
    async previewImport({ rootId, sourcePath, object = path.basename(sourcePath ?? '') }) {
      const root = getRoot(rootId); segment(object); await verifyRoot(root);
      if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) fail('INVALID_PATH');
      sourcePath = path.resolve(sourcePath);
      await chain(path.dirname(sourcePath));
      if (contains(root.state, sourcePath) || contains(sourcePath, root.path) || contains(root.path, sourcePath)) fail('SOURCE_DESTINATION_OVERLAP');
      const data = await scan(sourcePath);
      if (data.kind === 'flat' && !object.endsWith('.md')) fail('INVALID_OBJECT');
      await absent(root, object);
      return publishPreview({ operation: 'import', rootId, object, sourcePath, ...data });
    },
    async commitImport({ previewId, authorization }) {
      const p = await consume(previewId, authorization, 'import'); const root = getRoot(p.rootId);
      return locked(root, async () => {
        await chain(path.dirname(p.sourcePath));
        const current = await scan(p.sourcePath); if (current.versionDigest !== p.versionDigest) fail('OBJECT_CHANGED');
        await absent(root, p.object);
        if (p.kind === 'flat') {
          if (typeof createFlat !== 'function') fail('NATIVE_CREATE_UNAVAILABLE');
          await createFlat({ rootId: p.rootId, path: path.join(root.path, p.object), raw: current.raw });
          return { committed: true, object: p.object, visibility: 'pending-native-discovery' };
        }
        const id = randomUUID(); const container = path.join(root.state, id); await fs.mkdir(container, { mode: 0o700 });
        const record = { id, operation: 'import', rootId: root.id, rootIdentity: root.chain.at(-1)[1], object: p.object, digest: p.digest, status: 'prepared' };
        await manifest(container, record);
        const stage = path.join(container, 'stage'); await copy(p.sourcePath, stage, current);
        if ((await scan(p.sourcePath)).versionDigest !== p.versionDigest) fail('OBJECT_CHANGED');
        const staged = await scan(stage);
        const content = rows => rows.map(({ version, ...row }) => row);
        if (JSON.stringify(content(staged.inventory)) !== JSON.stringify(content(current.inventory))) fail('STAGE_MISMATCH');
        record.status = 'staged'; await manifest(container, record);
        await verifyRoot(root); const reservation = await reserve(root, p.object);
        record.status = 'reserved'; record.reservation = reservation; await manifest(container, record);
        await verifyReservation(reservation); await fs.rename(stage, reservation.destination);
        record.status = 'committed'; await manifest(container, record);
        return { committed: true, transactionId: id, object: p.object, visibility: 'pending-native-discovery' };
      });
    },
    async previewRemove({ rootId, object }) {
      const root = getRoot(rootId); segment(object); await verifyRoot(root);
      const data = await scan(path.join(root.path, object));
      return publishPreview({ operation: 'remove', rootId, object, ...data, affectedPaths: data.inventory.map(row => row.relative ? path.join(root.path, object, row.relative) : path.join(root.path, object)) });
    },
    async commitRemove({ previewId, authorization }) {
      const p = await consume(previewId, authorization, 'remove'); const root = getRoot(p.rootId);
      return locked(root, async () => {
        const source = path.join(root.path, p.object); const data = await scan(source);
        if (data.versionDigest !== p.versionDigest) fail('OBJECT_CHANGED');
        const id = randomUUID(); const container = path.join(root.state, id); await fs.mkdir(container, { mode: 0o700 });
        const record = { id, operation: 'remove', rootId: root.id, rootIdentity: root.chain.at(-1)[1], name: p.object, kind: p.kind, digest: p.digest, objectIdentity: p.identity, deletedAt: now(), status: 'prepared' };
        await manifest(container, record);
        const backup = path.join(container, 'backup');
        await copy(source, backup, data);
        if ((await scan(backup)).digest !== data.digest) fail('BACKUP_MISMATCH');
        if ((await scan(source)).versionDigest !== p.versionDigest) fail('OBJECT_CHANGED');
        record.backupDigest = data.digest;
        record.status = 'backed-up'; await manifest(container, record); await verifyRoot(root);
        if (identity(await fs.lstat(source)) !== p.identity) fail('OBJECT_CHANGED');
        await fs.rename(source, path.join(container, 'object'));
        record.status = 'committed'; await manifest(container, record);
        return { committed: true, recoveryId: id, backupPath: backup, visibility: 'pending-native-discovery' };
      });
    },
    async recovery({ rootId }) {
      const root = getRoot(rootId); await verifyRoot(root); const records = [];
      for (const id of await fs.readdir(root.state)) {
        if (id === 'lock') continue;
        try {
          const { container, record } = await readRecord(root, id);
          const status = await recoveryStatus(container, record);
          records.push({ id: record.id, operation: record.operation, rootId: record.rootId, name: record.name ?? record.object, kind: record.kind, status, deletedAt: record.deletedAt ?? record.createdAt ?? null });
        } catch { records.push({ id, status: 'needs-reconciliation' }); }
      }
      return records;
    },
    async recoveryDetail({ rootId, recoveryId }) {
      const root = getRoot(rootId); const { container, record } = await readRecord(root, recoveryId);
      const status = await recoveryStatus(container, record);
      if (status !== 'available') return { id: record.id, operation: record.operation, rootId: record.rootId, name: record.name ?? record.object, kind: record.kind, status, readOnly: true, reason: status === 'trashed' || status === 'purged' ? 'NOT_RESTORABLE_IN_PLUGIN' : 'RECOVERY_NEEDS_RECONCILIATION' };
      const data = await recoveryPayload(container);
      return { id: record.id, operation: record.operation, rootId: record.rootId, name: record.name ?? record.object, deletedAt: record.deletedAt ?? null, kind: record.kind, status, inventory: data.inventory, raw: data.raw, metadata: data.metadata, totalBytes: data.totalBytes, readOnly: false };
    },
    async reveal({ rootId, path: relativePath, recoveryId, folder = false }) {
      const root = getRoot(rootId); await verifyRoot(root);
      let target;
      if (recoveryId !== undefined) {
        const { container, record } = await readRecord(root, recoveryId);
        const status = await recoveryStatus(container, record);
        if (!['available', 'needs-reconciliation'].includes(status)) fail('RECOVERY_NOT_FOUND');
        target = path.join(container, 'object');
      } else {
        if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) fail('INVALID_PATH');
        const parts = relativePath.split('/'); if (parts.some(part => !part || part === '.' || part === '..')) fail('INVALID_PATH');
        target = path.join(root.path, ...parts);
        if (!contains(root.path, target)) fail('INVALID_PATH');
      }
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) fail('UNSAFE_FILE');
      await chain(path.dirname(target));
      const mapped = await mapPath(target);
      if (typeof mapped !== 'string' || !path.isAbsolute(mapped) || path.resolve(mapped) !== mapped) fail('HOST_FILESYSTEM_MAPPING_REQUIRED');
      const mappedStat = await fs.lstat(mapped);
      if (mappedStat.isSymbolicLink() || identity(mappedStat) !== identity(stat)) fail('HOST_FILESYSTEM_MAPPING_REQUIRED');
      await open(mapped, { folder: folder || stat.isDirectory() });
      return { revealed: true, kind: stat.isDirectory() ? 'folder' : 'file' };
    },
    async previewPurge({ rootId, recoveryId }) {
      const root = getRoot(rootId); const { container, record } = await readRecord(root, recoveryId);
      if (record.operation !== 'remove' || await recoveryStatus(container, record) !== 'available') fail('RECOVERY_NEEDS_RECONCILIATION');
      const data = await recoveryPayload(container), backup = await recoveryPayload(container, 'backup');
      if (!record.backupDigest || !data || !backup) fail('BACKUP_MISMATCH');
      return publishPreview({ operation: 'purge', rootId, recoveryId, name: record.name ?? record.object, ...data, sourcePath: path.join(container, 'object'), backupPath: path.join(container, 'backup'), affectedPaths: data.inventory.map(row => row.relative ? path.join(container, 'object', row.relative) : path.join(container, 'object')), backupVersionDigest: backup.versionDigest, destination: 'macos-finder-trash', restorableInPlugin: false, requiresConfirmation: true });
    },
    async purge({ previewId, authorization }) {
      const p = await consume(previewId, authorization, 'purge'); const root = getRoot(p.rootId);
      return locked(root, async () => {
        const { container, record } = await readRecord(root, p.recoveryId);
        const object = path.join(container, 'object'), backup = path.join(container, 'backup');
        const data = await recoveryPayload(container), copied = await recoveryPayload(container, 'backup');
        if (record.status !== 'committed' || data.versionDigest !== p.versionDigest || copied.versionDigest !== p.backupVersionDigest) fail('OBJECT_CHANGED');
        let safetyBackup = backup;
        if (data.digest !== copied.digest) {
          safetyBackup = path.join(container, `backup-${randomUUID()}`);
          await copy(object, safetyBackup, data);
          if ((await boundedPayload(safetyBackup)).digest !== data.digest) fail('BACKUP_MISMATCH');
        }
        if ((await boundedPayload(object)).versionDigest !== p.versionDigest) fail('OBJECT_CHANGED');
        record.safetyBackup = path.basename(safetyBackup);
        record.status = 'trashing'; await manifest(container, record);
        await verifyRoot(root);
        // 路径以参数数组交给系统废纸篓；绝不拼接shell，也不执行永久删除。
        await trash([object]);
        if (await statOrNone(object)) fail('TRASH_INCOMPLETE');
        if ((await boundedPayload(safetyBackup)).digest !== data.digest) fail('BACKUP_MISMATCH');
        record.status = 'trashed'; record.trashedAt = now(); await manifest(container, record);
        return { committed: true, recoveryId: p.recoveryId, status: 'trashed', destination: 'macos-finder-trash', backupPath: safetyBackup, restorableInPlugin: false };
      });
    },
    async previewRestore({ rootId, recoveryId }) {
      const root = getRoot(rootId); const { container, record } = await readRecord(root, recoveryId);
      if (record.operation !== 'remove' || record.status !== 'committed') fail('RECOVERY_NEEDS_RECONCILIATION');
      const data = await scan(path.join(container, 'object'));
      if (data.identity !== record.objectIdentity || data.digest !== record.digest) fail('OBJECT_CHANGED');
      await absent(root, record.name ?? record.object);
      return publishPreview({ operation: 'restore', rootId, recoveryId, object: record.name ?? record.object, ...data });
    },
    async restore({ previewId, authorization }) {
      const p = await consume(previewId, authorization, 'restore'); const root = getRoot(p.rootId);
      return locked(root, async () => {
        const { container, record } = await readRecord(root, p.recoveryId);
        const source = path.join(container, 'object'); const data = await scan(source);
        if (record.status !== 'committed' || data.versionDigest !== p.versionDigest || data.identity !== record.objectIdentity) fail('OBJECT_CHANGED');
        await absent(root, p.object);
        record.status = 'restoring'; await manifest(container, record);
        if (data.kind === 'directory') {
          const reservation = await reserve(root, p.object); record.reservation = reservation; await manifest(container, record);
          await verifyReservation(reservation); await fs.rename(source, reservation.destination);
        } else {
          const destination = path.join(root.path, p.object);
          await fs.link(source, destination);
          record.status = 'linked'; await manifest(container, record);
          if (identity(await fs.lstat(destination)) !== p.identity || identity(await fs.lstat(source)) !== p.identity) fail('OBJECT_CHANGED');
          await fs.unlink(source);
        }
        record.status = 'restored'; await manifest(container, record);
        return { committed: true, object: p.object, visibility: 'pending-native-discovery' };
      });
    },
  };
}
