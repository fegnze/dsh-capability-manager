import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createLocalStore, finderTrash } from '../src/skills/local-store.mjs';

const raw = '---\nname: sample\ndescription: Example\n---\nBody\n';
const validateRaw = text => { if (!text.startsWith('---\n') || !text.includes('name: sample')) throw Error('INVALID_SKILL'); return { name: 'sample' }; };
async function fixture(fn, options = {}) {
  const base = await fs.realpath(os.tmpdir());
  const home = await fs.mkdtemp(path.join(base, 'dsh-local-store-test-'));
  const root = path.join(home, 'skills'); const source = path.join(home, 'source');
  await fs.mkdir(root); await fs.mkdir(source); await fs.writeFile(path.join(source, 'SKILL.md'), raw);
  await fs.mkdir(path.join(source, 'assets')); await fs.writeFile(path.join(source, 'assets', 'binary.dat'), Buffer.from([0,255,1,128]));
  try {
    const config = { roots: [{ id: 'local', path: root, trusted: true }], validateRaw, authorize: async ({authorization}) => authorization === 'owner', ...options };
    const store = await createLocalStore(config);
    await fn({ home, root, source, store, config, state: path.join(home, '.dsh-capability-manager-skills-state') });
  } finally {
    const absolute = path.resolve(home);
    assert.equal(path.dirname(absolute), base); assert.ok(path.basename(absolute).startsWith('dsh-local-store-test-'));
    await fs.rm(absolute, { recursive: true, force: true });
  }
}
const importBundle = async (store, source, object='sample') => {
  const p=await store.previewImport({rootId:'local',sourcePath:source,object});
  return store.commitImport({previewId:p.id,authorization:'owner'});
};
test('macOS complete import preserves binary bytes, native-shaped raw and one-use approvals', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,root})=>{
  await fs.writeFile(path.join(source,'assets/run.sh'),'#!/bin/sh\nexit 99\n');
  await fs.chmod(path.join(source,'assets/run.sh'),0o755);
  await fs.chmod(path.join(source,'assets/binary.dat'),0o751);
  const p=await store.previewImport({rootId:'local',sourcePath:source,object:'sample'});
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'agent'}),{code:'OWNER_APPROVAL_REQUIRED'});
  const result=await store.commitImport({previewId:p.id,authorization:'owner'});
  assert.equal(result.committed,true);
  assert.equal((await fs.stat(path.join(root,'sample/assets/run.sh'))).mode&0o7777,0o755);
  assert.equal((await fs.stat(path.join(root,'sample/assets/binary.dat'))).mode&0o7777,0o751);
  assert.deepEqual(await fs.readFile(path.join(root,'sample/assets/binary.dat')),Buffer.from([0,255,1,128]));
  assert.equal((await store.raw({rootId:'local',object:'sample'})).raw,raw);
  assert.equal((await store.inventory({rootId:'local'}))[0].readOnly,false);
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'owner'}),{code:'PREVIEW_EXPIRED'});
}));
test('whole bundle removal and restore retain resources and persist recovery across store reload', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,root,config})=>{
  await importBundle(store,source);
  const p=await store.previewRemove({rootId:'local',object:'sample'});
  const removed=await store.commitRemove({previewId:p.id,authorization:'owner'});
  await assert.rejects(fs.stat(path.join(root,'sample')),{code:'ENOENT'});
  store=await createLocalStore(config);
  const records=await store.recovery({rootId:'local'});
  assert.equal(records.find(r=>r.id===removed.recoveryId).status,'available');
  const restore=await store.previewRestore({rootId:'local',recoveryId:removed.recoveryId});
  await store.restore({previewId:restore.id,authorization:'owner'});
  assert.equal(await fs.readFile(path.join(root,'sample/SKILL.md'),'utf8'),raw);
  assert.equal((await store.recovery({rootId:'local'})).find(r=>r.id===removed.recoveryId).status,'restored');
}));
test('case collisions, unsafe names, links, hardlinks, nested skills and limits fail closed', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,root,home,config})=>{
  await fs.mkdir(path.join(root,'SAMPLE'));
  await assert.rejects(importBundle(store,source),{code:'TARGET_EXISTS'});
  await assert.rejects(store.raw({rootId:'local',object:'../source'}),{code:'INVALID_OBJECT'});
  await fs.symlink(source,path.join(home,'linked'));
  await assert.rejects(store.previewImport({rootId:'local',sourcePath:path.join(home,'linked'),object:'other'}),{code:'SYMLINK_FORBIDDEN'});
  await fs.link(path.join(source,'SKILL.md'),path.join(home,'hard'));
  await assert.rejects(store.previewImport({rootId:'local',sourcePath:source,object:'other'}),{code:'UNSAFE_FILE'});
  await fs.unlink(path.join(home,'hard'));
  await fs.writeFile(path.join(source,'assets/SKILL.md'),raw);
  await assert.rejects(store.previewImport({rootId:'local',sourcePath:source,object:'other'}),{code:'AMBIGUOUS_SKILL'});
  await fs.unlink(path.join(source,'assets/SKILL.md'));
  const bounded=await createLocalStore({...config,limits:{bytes:10}});
  await assert.rejects(bounded.previewImport({rootId:'local',sourcePath:source,object:'other'}),{code:'LIMIT_EXCEEDED'});
}));
test('stale preview, existing empty target and restore conflict never overwrite', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,root})=>{
  const p=await store.previewImport({rootId:'local',sourcePath:source,object:'sample'});
  await fs.writeFile(path.join(source,'assets/binary.dat'),'changed');
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'owner'}),{code:'OBJECT_CHANGED'});
  await importBundle(store,source);
  const remove=await store.previewRemove({rootId:'local',object:'sample'});
  const {recoveryId}=await store.commitRemove({previewId:remove.id,authorization:'owner'});
  await fs.mkdir(path.join(root,'sample'));
  await assert.rejects(store.previewRestore({rootId:'local',recoveryId}),{code:'TARGET_EXISTS'});
  assert.deepEqual(await fs.readdir(path.join(root,'sample')),[]);
}));
test('flat imports call injected native createIfAbsent seam and restore with no-overwrite hardlink', {skip:process.platform!=='darwin'}, async () => fixture(async ({source,home,root,config})=>{
  const flat=path.join(home,'sample.md'); await fs.writeFile(flat,raw); let nativeCalls=0;
  const store=await createLocalStore({...config,createFlat:async({path:p,raw:text})=>{nativeCalls++;await fs.writeFile(p,text,{flag:'wx'});}});
  await importBundle(store,flat,'sample.md'); assert.equal(nativeCalls,1);
  const p=await store.previewRemove({rootId:'local',object:'sample.md'});
  const {recoveryId}=await store.commitRemove({previewId:p.id,authorization:'owner'});
  const r=await store.previewRestore({rootId:'local',recoveryId});
  await store.restore({previewId:r.id,authorization:'owner'});
  assert.equal(await fs.readFile(path.join(root,'sample.md'),'utf8'),raw);
  assert.equal((await fs.stat(path.join(root,'sample.md'))).nlink,1);
}));
test('active or stale lock refuses mutation without stealing it', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,state,root})=>{
  const p=await store.previewImport({rootId:'local',sourcePath:source,object:'sample'});
  await fs.mkdir(path.join(state,'lock'));
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'owner'}),{code:'ROOT_BUSY'});
  assert.equal((await fs.stat(path.join(state,'lock'))).isDirectory(),true);
  assert.deepEqual(await fs.readdir(root),[]);
}));
test('post-move manifest failure retains object and reports reconciliation, no automatic purge', {skip:process.platform!=='darwin'}, async () => fixture(async ({store,source,root,config,state})=>{
  await importBundle(store,source);
  let moved=false;
  const adapter={...fs,rename:async(a,b)=>{if(a===path.join(root,'sample'))moved=true;if(moved&&b.endsWith('manifest.json'))throw Error('INJECTED_MANIFEST_FAILURE');return fs.rename(a,b);}};
  store=await createLocalStore({...config,fs:adapter});
  const p=await store.previewRemove({rootId:'local',object:'sample'});
  await assert.rejects(store.commitRemove({previewId:p.id,authorization:'owner'}),/INJECTED/);
  const records=await store.recovery({rootId:'local'});
  assert.ok(records.some(r=>r.operation==='remove'&&r.status==='needs-reconciliation'));
  assert.ok((await fs.readdir(state)).length>0);
}));
test('changed root identity is refused; expired preview cannot commit', {skip:process.platform!=='darwin'}, async()=>fixture(async({config,root,source})=>{
  let clock=100;
  const store=await createLocalStore({...config,now:()=>clock,limits:{ttlMs:10}});
  const p=await store.previewImport({rootId:'local',sourcePath:source,object:'sample'});
  clock=111;
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'owner'}),{code:'PREVIEW_EXPIRED'});
  const replacement=`${root}-original`;
  assert.equal(path.dirname(replacement),path.dirname(root));
  await fs.rename(root,replacement); await fs.mkdir(root);
  await assert.rejects(store.inventory({rootId:'local'}),{code:'ROOT_CHANGED'});
}));
test('fault before publication preserves staged data and exposes no partial skill', {skip:process.platform!=='darwin'}, async()=>fixture(async({config,source,root})=>{
  const adapter={...fs,rename:async(a,b)=>{if(a.endsWith('/stage'))throw Error('INJECTED_PUBLISH_FAILURE');return fs.rename(a,b);}};
  const store=await createLocalStore({...config,fs:adapter});
  const p=await store.previewImport({rootId:'local',sourcePath:source,object:'sample'});
  await assert.rejects(store.commitImport({previewId:p.id,authorization:'owner'}),/INJECTED/);
  assert.deepEqual(await fs.readdir(path.join(root,'sample')),[]);
  assert.ok((await store.recovery({rootId:'local'})).some(r=>r.status==='needs-reconciliation'));
}));
test('删除先复制并验证备份，回收详情包含完整清单，purge走系统废纸篓且保留manifest', {skip:process.platform!=='darwin'}, async()=>fixture(async({config,source,state,home})=>{
  const trashed=path.join(home,'mock-trash'); await fs.mkdir(trashed); let calls=0;
  const store=await createLocalStore({...config,trash:async paths=>{calls++;for(const [index,source] of paths.entries())await fs.rename(source,path.join(trashed,String(index)));}});
  await importBundle(store,source);
  const remove=await store.previewRemove({rootId:'local',object:'sample'});
  const {recoveryId}=await store.commitRemove({previewId:remove.id,authorization:'owner'});
  assert.equal(await fs.readFile(path.join(state,recoveryId,'backup/SKILL.md'),'utf8'),raw);
  const detail=await store.recoveryDetail({rootId:'local',recoveryId});
  assert.equal(detail.raw,raw);assert.equal(detail.readOnly,false);assert.equal(detail.restorable,undefined);assert.equal(detail.root,undefined);assert.ok(detail.inventory.some(row=>row.relative==='assets/binary.dat'));
  const purge=await store.previewPurge({rootId:'local',recoveryId});assert.equal(purge.restorableInPlugin,false);
  await assert.rejects(store.purge({previewId:purge.id,authorization:'agent'}),{code:'OWNER_APPROVAL_REQUIRED'});
  const result=await store.purge({previewId:purge.id,authorization:'owner'});assert.equal(result.status,'trashed');assert.equal(calls,1);
  assert.equal(result.backupPath,path.join(state,recoveryId,'backup'));
  assert.equal(await fs.readFile(path.join(result.backupPath,'SKILL.md'),'utf8'),raw);
  assert.deepEqual(await fs.readdir(trashed),['0']);
  assert.equal((await store.recovery({rootId:'local'})).find(row=>row.id===recoveryId).status,'trashed');
  assert.equal((await store.recoveryDetail({rootId:'local',recoveryId})).restorable,undefined);
  assert.equal(JSON.parse(await fs.readFile(path.join(state,recoveryId,'manifest.json'),'utf8')).status,'trashed');
  await assert.rejects(store.previewRestore({rootId:'local',recoveryId}),{code:'RECOVERY_NEEDS_RECONCILIATION'});
}));
test('备份写入失败不移动原件，废纸篓失败保留对象并要求协调', {skip:process.platform!=='darwin'}, async()=>fixture(async({store,config,source,root,state})=>{
  await importBundle(store,source);
  const adapter={...fs,writeFile:async(p,...args)=>{if(p.includes('/backup/'))throw Error('INJECTED_BACKUP_FAILURE');return fs.writeFile(p,...args);}};
  const failing=await createLocalStore({...config,fs:adapter});
  const preview=await failing.previewRemove({rootId:'local',object:'sample'});
  await assert.rejects(failing.commitRemove({previewId:preview.id,authorization:'owner'}),/INJECTED_BACKUP/);
  assert.equal(await fs.readFile(path.join(root,'sample/SKILL.md'),'utf8'),raw);
  const trashFailure=await createLocalStore({...config,trash:async()=>{throw Error('INJECTED_TRASH_FAILURE');}});
  const remove=await trashFailure.previewRemove({rootId:'local',object:'sample'});
  const {recoveryId}=await trashFailure.commitRemove({previewId:remove.id,authorization:'owner'});
  const purge=await trashFailure.previewPurge({rootId:'local',recoveryId});
  await assert.rejects(trashFailure.purge({previewId:purge.id,authorization:'owner'}),/INJECTED_TRASH/);
  assert.equal(await fs.readFile(path.join(state,recoveryId,'object/SKILL.md'),'utf8'),raw);
  assert.equal((await trashFailure.recovery({rootId:'local'})).find(row=>row.id===recoveryId).status,'needs-reconciliation');
}));
test('篡改回收对象或备份拒绝purge且不调用废纸篓', {skip:process.platform!=='darwin'}, async()=>fixture(async({config,source,state})=>{
  let calls=0;const store=await createLocalStore({...config,trash:async()=>{calls++;}});
  await importBundle(store,source);const remove=await store.previewRemove({rootId:'local',object:'sample'});
  const {recoveryId}=await store.commitRemove({previewId:remove.id,authorization:'owner'});
  const preview=await store.previewPurge({rootId:'local',recoveryId});
  await fs.writeFile(path.join(state,recoveryId,'backup/assets/binary.dat'),'tampered');
  await assert.rejects(store.purge({previewId:preview.id,authorization:'owner'}),{code:'OBJECT_CHANGED'});
  const next=await store.previewPurge({rootId:'local',recoveryId});
  await fs.writeFile(path.join(state,recoveryId,'object/SKILL.md'),'changed after preview');
  await assert.rejects(store.purge({previewId:next.id,authorization:'owner'}),{code:'OBJECT_CHANGED'});
  assert.equal(calls,0);
}));
test('失效回收内容可查看定位和清理，清理前备份当前内容且不覆盖旧备份', {skip:process.platform!=='darwin'}, async()=>fixture(async({config,source,state,home})=>{
  const trashed=path.join(home,'invalid-trash');await fs.mkdir(trashed);let opened;
  const store=await createLocalStore({...config,open:async target=>{opened=target;},trash:async paths=>fs.rename(paths[0],path.join(trashed,'object'))});
  await importBundle(store,source);const preview=await store.previewRemove({rootId:'local',object:'sample'});
  const {recoveryId}=await store.commitRemove({previewId:preview.id,authorization:'owner'});
  const container=path.join(state,recoveryId), invalid='not a skill anymore';
  await fs.writeFile(path.join(container,'object/SKILL.md'),invalid);
  const detail=await store.recoveryDetail({rootId:'local',recoveryId});
  assert.equal(detail.raw,invalid);assert.equal(detail.readOnly,false);assert.ok(detail.deletedAt);
  await store.reveal({rootId:'local',recoveryId});assert.equal(opened,path.join(container,'object'));
  const purge=await store.previewPurge({rootId:'local',recoveryId});
  const result=await store.purge({previewId:purge.id,authorization:'owner'});
  assert.notEqual(result.backupPath,path.join(container,'backup'));
  assert.equal(await fs.readFile(path.join(result.backupPath,'SKILL.md'),'utf8'),invalid);
  assert.equal(await fs.readFile(path.join(container,'backup/SKILL.md'),'utf8'),raw);
  assert.equal(await fs.readFile(path.join(trashed,'object/SKILL.md'),'utf8'),invalid);
}));
test('Finder调用使用参数数组传递路径，不把路径插入AppleScript',async()=>{
  const paths=['/test/quote";name','/test/other'];let call;
  await finderTrash(paths,async(...args)=>{call=args;});
  assert.equal(call[0],'/usr/bin/osascript');assert.deepEqual(call[1].slice(-3),['--',...paths]);
  assert.ok(!call[1][1].includes(paths[0]));assert.equal(call[2].timeout,30000);
});
test('unsupported platform, missing trust and overlapping roots fail closed', async()=>{
  await assert.rejects(createLocalStore({platform:'linux',validateRaw}),{code:'CAPABILITY_UNAVAILABLE'});
  if(process.platform==='darwin')await fixture(async({config,root})=>{
    await assert.rejects(createLocalStore({...config,roots:[{id:'x',path:root}]}),{code:'ROOT_UNAUTHORIZED'});
    await assert.rejects(createLocalStore({...config,roots:[...config.roots,{id:'y',path:root,trusted:true}]}),{code:'ROOT_OVERLAP'});
  });
});
