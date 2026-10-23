import { randomUUID } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { ManagerError } from '../errors.mjs';
import { validateRaw } from './grammar.mjs';
export function createOperations({store,fs,roots,now=Date.now}) {
  const previews=new Map();
  const rootFor=id=>{const root=roots.find(r=>r.id===id&&r.trusted===true);if(!root)throw new ManagerError('ROOT_NOT_AUTHORIZED',403);return root;};
  const targetFor=async(rootId,path,{create=false}={})=>{
    const root=rootFor(rootId);
    if(typeof path!=='string'||!path||path.includes('\\')||path.includes('\0')||path.split('/').some(p=>!p||p==='.'||p==='..'))throw new ManagerError('INVALID_PATH');
    const absolute=resolve(root.path,path),rel=relative(resolve(root.path),absolute);
    if(rel.startsWith('..'+sep)||rel==='..'||!rel)throw new ManagerError('INVALID_PATH');
    const rootAbsolute=resolve(root.path);let ancestor=sep;for(const part of rootAbsolute.split(sep).filter(Boolean)){ancestor=join(ancestor,part);const info=await fs.lstat(ancestor);if(!info||info.type!=='directory')throw new ManagerError('READ_ONLY',403);}
    let current=resolve(root.path);for(const part of path.split('/')){current=join(current,part);const info=await fs.lstat(current);if(!info){if(create&&current===absolute)break;throw new ManagerError('NOT_FOUND',404);}if(info.type==='symlink'||info.type==='other')throw new ManagerError('READ_ONLY',403);}
    const rootTarget=await fs.resolve(root.path),target=await fs.resolve(absolute);if(!fs.contains(rootTarget,target))throw new ManagerError('READ_ONLY',403);return {target,absolute};
  };
  const raw=async({rootId,path})=>{
    const items=await store.inventory({rootId});const item=(Array.isArray(items)?items:items.items).find(i=>(i.object??i.path)===path);
    if(!item||item.readOnly)throw new ManagerError('READ_ONLY',403);
    const filename=['directory','bundle'].includes(item.kind)?`${path}/SKILL.md`:path;
    const {target}=await targetFor(rootId,filename);const before=await fs.stat(target);if(before?.type!=='file'||before.size>1024*1024)throw new ManagerError('INVALID_SKILL');
    const content=await fs.readText(target);const after=await fs.stat(target);if(!after||before.version!==after.version)throw new ManagerError('FS_STALE_VERSION',409);
    return {rootId,path,raw:content,version:after.version};
  };
  return {
    async local(){const items=[],recovery=[];for(const root of roots){const inv=await store.inventory({rootId:root.id});items.push(...(Array.isArray(inv)?inv:inv.items).map(i=>({...i,...i.metadata,rootId:root.id,path:i.object??i.path,reason:i.error})));const rows=await store.recovery({rootId:root.id});recovery.push(...(Array.isArray(rows)?rows:rows.items??rows.recovery??[]).map(i=>({...i,rootId:root.id})));}return {roots:roots.map(({id,path})=>({id,path})),items,recovery,capabilities:{edit:true,create:true,directoryTransactions:process.platform==='darwin'}};},
    raw,
    async recoveryDetail(args){rootFor(args.rootId);return store.recoveryDetail(args);},
    async reveal(args){rootFor(args.rootId);return store.reveal(args);},
    async preview(args){
      if(!['edit','create','import','remove','purge'].includes(args.operation))throw new ManagerError('UNSUPPORTED_ACTION');
      rootFor(args.rootId);if(previews.size>=100){for(const [id,p]of previews)if(p.expiresAt<now())previews.delete(id);if(previews.size>=100)throw new ManagerError('TOO_MANY_PREVIEWS',429);}let value;
      if(args.operation==='edit'||args.operation==='create'){
        const metadata=validateRaw(args.raw);if(args.operation==='edit'){const current=await raw(args);if(current.version!==args.version)throw new ManagerError('FS_STALE_VERSION',409);if(validateRaw(current.raw).name!==metadata.name)throw new ManagerError('NAME_CHANGE_NOT_SUPPORTED');}
        else {if(!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(args.path))throw new ManagerError('INVALID_PATH');const items=await store.inventory({rootId:args.rootId});if(items.some(i=>(i.object??i.path).normalize('NFC').toLowerCase()===args.path.normalize('NFC').toLowerCase()))throw new ManagerError('TARGET_EXISTS',409);}
        value={operation:args.operation,rootId:args.rootId,path:args.path,name:metadata.name};
      }else if(args.operation==='import')value=await store.previewImport({rootId:args.rootId,sourcePath:args.sourcePath,object:args.path});
      else if(args.operation==='remove'){
        const items=await store.inventory({rootId:args.rootId});
        const item=(Array.isArray(items)?items:items.items).find(item=>(item.object??item.path)===args.path);
        if(!item||item.readOnly)throw new ManagerError('READ_ONLY',403);
        value=await store.previewRemove({rootId:args.rootId,object:args.path});
      }
      else if(args.operation==='purge')value=await store.previewPurge({rootId:args.rootId,recoveryId:args.recoveryId});
      const previewId=randomUUID(),expiresAt=now()+5*60*1000;previews.set(previewId,{args:structuredClone(args),value,expiresAt});return {previewId,operation:args.operation,summary:value,files:value.inventory??[],expiresAt};
    },
    async commit({previewId,confirm}){
      const preview=previews.get(previewId);if(!preview||preview.expiresAt<now())throw new ManagerError('PREVIEW_EXPIRED',409);
      if(preview.args.operation==='purge'&&confirm!==true)throw new ManagerError('CONFIRM_REQUIRED');
      previews.delete(previewId);
      const {args,value}=preview;let result;
      if(args.operation==='edit'||args.operation==='create'){
        if(args.operation==='edit'){const current=await raw(args);if(current.version!==args.version)throw new ManagerError('FS_STALE_VERSION',409);}
        const path=args.operation==='edit'?((await store.inventory({rootId:args.rootId})).find(i=>(i.object??i.path)===args.path)?.kind?.match(/^(directory|bundle)$/)?`${args.path}/SKILL.md`:args.path):args.path;
        const {target}=await targetFor(args.rootId,path,{create:args.operation==='create'});result=await fs.writeText(target,args.raw,args.operation==='create'?{kind:'createIfAbsent'}:{kind:'replaceIfVersion',version:args.version});
      }else{const method={import:'commitImport',remove:'commitRemove',purge:'purge'}[args.operation];result=await store[method]({previewId:value.id??value.previewId,authorization:{owner:true}});}
      return {operation:args.operation,result,catalogVisibility:'pending-native-discovery'};
    }
  };
}
