import { ManagerError } from './errors.mjs';
import { ImportError } from './mcp/import.mjs';
import { AssistantError } from './assistants/errors.mjs';
export const ROUTE = '/dsh-capability-manager/api';
export const HEADER = 'x-dsh-capability-manager';
const send=(res,status,body)=>{res.writeHead(status,{ 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
async function json(req){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new ManagerError('CONTENT_TYPE',415);
  const chunks=[];let size=0;
  for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>2*1024*1024)throw new ManagerError('BODY_TOO_LARGE',413);chunks.push(bytes);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ManagerError('INVALID_JSON');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new ManagerError('INVALID_REQUEST');
  return body;
}
const SKILL_GET=new Set(['list','detail','local','raw','projects','recoveryDetail']);
const SKILL_POST=new Set(['preview','commit','reveal']);
const MCP_POST={check:'check',preview:'preview',executionPreview:'executionPreview',import:'importServers',update:'update',toggle:'toggle',remove:'remove'};
/** Tab selects the subject; the action selects the operation. */
const tabOf=(value,fallback)=>value==null||value===''?fallback:value==='skills'||value==='mcp'||value==='assistants'?value:undefined;
/** Authentication is delegated to the host; never infer trust from loopback alone. */
export function createHandler({skills,mcp,assistants,admit,isBrowserPeer=()=>false}){
  return async(req,res)=>{
    try{
      if(req.headers[HEADER]!=='1')throw new ManagerError('FORBIDDEN',403);
      const admission=admit(req);
      if(admission?.rejection!==undefined||!admission?.peer)throw new ManagerError('UNAUTHENTICATED',admission?.rejection??403);
      if(admission.peer.principal?.kind!=='owner')throw new ManagerError('FORBIDDEN',403);
      // admit already validates authority, origin and the signed session cookie.
      // Electron strips Origin/Fetch Metadata before forwarding HTTP requests.
      // API peers can also be owner; only the host's actual browserPeer may write.
      if(req.method==='POST' && !isBrowserPeer(admission.peer)) throw new ManagerError('FORBIDDEN',403);
      const url=new URL(req.url,'http://localhost'),params=url.searchParams;
      if(req.method==='GET'){
        const tab=tabOf(params.get('tab'),'skills');
        if(!tab)throw new ManagerError('UNSUPPORTED_ACTION');
        if(tab==='mcp'){
          for(const key of params.keys())if(key!=='tab')throw new ManagerError('INVALID_REQUEST');
          return send(res,200,{ok:true,value:await mcp.list()});
        }
        const action=params.get('action')??'list';
        if(tab==='assistants'){
          if(!assistants)throw new ManagerError('ASSISTANTS_UNAVAILABLE',503);
          const options={};
          for(const key of params.keys()){
            if(params.getAll(key).length!==1)throw new ManagerError('INVALID_REQUEST');
            if(key!=='tab'&&key!=='action')options[key]=params.get(key);
          }
          return send(res,200,{ok:true,value:await assistants.read(action,options,admission.peer.signal)});
        }
        if(!SKILL_GET.has(action))throw new ManagerError('UNSUPPORTED_ACTION');
        const allowed=new Set(['tab','action','sessionId','cwd',...(action==='detail'?['name']:[]),...(action==='raw'?['rootId','path']:[]),...(action==='recoveryDetail'?['rootId','recoveryId']:[])]);
        for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length!==1)throw new ManagerError('INVALID_REQUEST');
        const options={signal:admission.peer.signal};
        if(params.has('sessionId'))options.sessionId=params.get('sessionId');
        if(params.has('cwd'))options.cwd=params.get('cwd');
        if(typeof skills[action]!=='function')throw new ManagerError('LOCAL_MANAGEMENT_UNAVAILABLE',503);
        const value=action==='detail'?await skills.detail({...options,name:params.get('name')})
          :action==='raw'?await skills.raw({...options,rootId:params.get('rootId'),path:params.get('path')})
          :action==='recoveryDetail'?await skills.recoveryDetail({...options,rootId:params.get('rootId'),recoveryId:params.get('recoveryId')})
          :await skills[action](options);
        return send(res,200,{ok:true,value});
      }
      if(req.method!=='POST')throw new ManagerError('METHOD_NOT_ALLOWED',405);
      const body=await json(req);
      const tab=tabOf(body.tab,'skills');
      if(!tab||typeof body.action!=='string')throw new ManagerError('UNSUPPORTED_ACTION');
      const {tab:_ignored,...args}=body;
      let value;
      if(tab==='assistants'){
        if(!assistants)throw new ManagerError('ASSISTANTS_UNAVAILABLE',503);
        const {action,...options}=args;
        value=await assistants.write(action,options,admission.peer.signal);
      }else if(tab==='mcp'){
        const method=Object.hasOwn(MCP_POST,args.action)?MCP_POST[args.action]:undefined;
        if(!method||typeof mcp[method]!=='function')throw new ManagerError('UNSUPPORTED_ACTION');
        value=await mcp[method](args);
      }else{
        if(!SKILL_POST.has(args.action))throw new ManagerError('UNSUPPORTED_ACTION');
        if(typeof skills[args.action]!=='function')throw new ManagerError('LOCAL_MANAGEMENT_UNAVAILABLE',503);
        value=await skills[args.action](args);
      }
      return send(res,200,{ok:true,value});
    }catch(error){
      const known=error instanceof ManagerError||error instanceof ImportError||error instanceof AssistantError;
      send(res,known?error.status??400:500,{ok:false,error:{code:known?error.code:'OPERATION_FAILED'}});
    }
  };
}
