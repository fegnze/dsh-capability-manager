window.__ModuleLoader__.load({id:'@fegnze/dsh-capability-manager',factory:require=>{
  const React=require('react'),h=React.createElement,NS='dsh-capability-manager';
  const dict={
    en:{title:'Skills • MCP',skills:'Skills',mcp:'MCP',refresh:'Refresh',search:'Search skills',session:'Session',all:'Current session',loading:'Loading…',empty:'Nothing here yet',detail:'Details',close:'Close',model:'Model',user:'User',yes:'Yes',no:'No',provider:'Provider',source:'Source',path:'Path',partial:'Discovery incomplete; some skills may be missing.',failed:'Request failed. Refresh and try again.',subtitle:'Manage the Skills and MCP servers this session can use',count:'skills',projectLevel:'Project',globalLevel:'Global',bundledLevel:'Bundled',projEmpty:'No project-level skills',recovery:'Recovery',readOnly:'Read-only',noRoots:'Add an authorized skill directory in this plugin configuration first.',installed:'Local files',external:'Managed by another plugin',enabled:'Enabled',disabled:'Disabled',addServer:'Add server',jsonConfig:'MCP JSON configuration',tools:'Registered MCP tools',connect:'Connect',connectConfirm:'Import this configuration and start the server now?',unnamed:'Unnamed',projectSkills:'Project skills',globalSkills:'Global skills',bundledSkills:'Bundled skills',localFiles:'Local files',recoveryZone:'Recovery',configuredServers:'Configured servers',externalServers:'Managed by another plugin',registeredTools:'Registered MCP tools',addServerForm:'Add MCP server',removeServer:'Remove',open:'Details',project:'Project',noServers:'No MCP server configured yet',noTools:'No MCP tool registered yet',serverName:'Server',transport:'Transport',endpoint:'Endpoint',state:'State',phase:'Phase',connection:'Connection',reachable:'Reachable',unreachable:'Connection failed',unknown:'Unknown',headerCount:'Headers',envCount:'Environment variables',argumentCount:'Launch arguments',secretNote:'Credential values, commands and environment values are never sent to this page.',toolName:'Tool name',toolServer:'Owning server',toolLocal:'Name inside the server',toolNote:'This page reads tool names only; MCP tool descriptions and input schemas are not projected to the browser.',checking:'Checking…',notProbed:'Disabled, not probed',readonlyProbe:'Read-only server, not probed',probeMethod:'Probe',checkedAt:'Checked at',checkFailed:'Check failed',serverTools:'Tools on this server',noServerTools:'No tool registered for this server'},
    zh:{title:'技能 • MCP',skills:'技能',mcp:'MCP',refresh:'刷新',search:'搜索技能',session:'会话',all:'当前会话',loading:'加载中…',empty:'暂无内容',detail:'详情',close:'关闭',model:'模型调用',user:'用户调用',yes:'允许',no:'不允许',provider:'提供方',source:'来源',path:'路径',partial:'发现未完成，部分技能可能缺失。',failed:'请求失败，请刷新重试。',subtitle:'管理当前会话可用的技能与 MCP 服务',count:'项技能',projectLevel:'项目级',globalLevel:'全局',bundledLevel:'内置',projEmpty:'该项目下没有项目级技能',recovery:'回收区',readOnly:'只读',noRoots:'请先在本插件配置中添加已授权的技能目录。',installed:'本地文件',external:'其他插件管理',enabled:'已启用',disabled:'已停用',addServer:'新增服务',jsonConfig:'MCP JSON 配置',tools:'已注册 MCP 工具',connect:'连接',connectConfirm:'导入该配置并立即启动这个服务？',unnamed:'未命名',projectSkills:'项目级技能',globalSkills:'全局技能',bundledSkills:'内置技能',localFiles:'本地文件',recoveryZone:'回收区',configuredServers:'已配置服务',externalServers:'其他插件管理',registeredTools:'已注册 MCP 工具',addServerForm:'新增 MCP 服务',removeServer:'删除',open:'详情',project:'项目',noServers:'尚未配置 MCP 服务',noTools:'尚未注册 MCP 工具',serverName:'服务名',transport:'传输',endpoint:'端点',state:'状态',phase:'阶段',connection:'连接',reachable:'可连接',unreachable:'连接失败',unknown:'未知',headerCount:'请求头',envCount:'环境变量',argumentCount:'启动参数',secretNote:'凭据、命令与环境变量的值不会下发到这个页面。',toolName:'工具名',toolServer:'归属服务',toolLocal:'服务内名称',toolNote:'本页只读取工具名：MCP 工具的描述与入参 schema 不下发到浏览器。',checking:'检测中…',notProbed:'未启用，未做探测',readonlyProbe:'只读服务，未做探测',probeMethod:'检测方式',checkedAt:'检测时间',checkFailed:'检测失败',serverTools:'所属工具',noServerTools:'该服务当前没有注册工具'}
  };
  Object.assign(dict.zh,{deleteSkill:'删除',purgeFile:'彻底删除',deleteTitle:'删除此技能？',purgeTitle:'彻底删除此条目？',deleteNote:'删除后，此技能将不再从该位置加载。',purgeNote:'此条目将移至系统废纸篓。',openFolder:'打开文件夹',deletedAt:'删除时间',files:'文件',cancel:'取消',deleted:'已删除',localUnavailable:'本地文件管理暂不可用',defaultRoot:'默认路径',deleteFailed:'操作失败，请重试。'});
  Object.assign(dict.en,{deleteSkill:'Delete',purgeFile:'Delete permanently',deleteTitle:'Delete this skill?',purgeTitle:'Delete this item?',deleteNote:'This skill will no longer be loaded from this location.',purgeNote:'This item will be moved to the system Trash.',openFolder:'Open folder',deletedAt:'Deleted at',files:'Files',cancel:'Cancel',deleted:'Deleted',localUnavailable:'Local file management unavailable',defaultRoot:'Default path',deleteFailed:'Operation failed. Please try again.'});
  Object.assign(dict.zh,{title:'技能 • MCP • 助理',assistants:'助理',selectAssistant:'选择助理',selectedAssistant:'已选助理',noAssistants:'暂无助理',installAssistant:'安装助理',managePlugins:'在插件管理中管理',packageName:'包名',version:'版本',digest:'内容摘要',requiredPreset:'所需预设',currentPreset:'当前预设',capabilities:'能力',ready:'就绪','configuration-required':'待配置',incompatible:'不兼容',unavailable:'不可用',unbound:'未选择',preparing:'启用中',bound:'已启用',blocked:'已阻断',confirmAssistant:'确认选择',copyContinuation:'复制接续提示',copied:'已复制',copyFailed:'复制失败，请手动复制',continuation:'新会话接续提示',selectPreset:'首次任务前将选择所需预设',blockedSelection:'当前无法启用',bindingUnavailable:'助理状态暂不可用',blockedFeedback:'任务已阻断，请查看详情',retry:'重试',status:'状态',assistantIdentity:'助理标识'});
  Object.assign(dict.en,{title:'Skills • MCP • Assistants',assistants:'Assistants',selectAssistant:'Select assistant',selectedAssistant:'Selected assistant',noAssistants:'No assistants',installAssistant:'Install assistant',managePlugins:'Manage in Plugins',packageName:'Package',version:'Version',digest:'Content digest',requiredPreset:'Required preset',currentPreset:'Current preset',capabilities:'Capabilities',ready:'Ready','configuration-required':'Configuration required',incompatible:'Incompatible',unavailable:'Unavailable',unbound:'Not selected',preparing:'Activating',bound:'Active',blocked:'Blocked',confirmAssistant:'Confirm selection',copyContinuation:'Copy continuation prompt',copied:'Copied',copyFailed:'Copy failed. Copy the prompt manually.',continuation:'New-session continuation prompt',selectPreset:'The required preset will be selected before the first task',blockedSelection:'Cannot activate now',bindingUnavailable:'Assistant status unavailable',blockedFeedback:'Tasks blocked. Open details.',retry:'Retry',status:'Status',assistantIdentity:'Assistant ID'});
  Object.assign(dict.zh,{confirmRetry:'确认重试',identityChanged:'助理身份已变化，不能在此会话重试。请新建会话。',packageUnavailable:'助理包不可用，请在插件管理中检查原版本。'});
  Object.assign(dict.en,{confirmRetry:'Confirm retry',identityChanged:'The assistant identity changed. Continue in a new session.',packageUnavailable:'Assistant package unavailable. Check the original version in Plugins.'});
  const css=`.dcm{box-sizing:border-box;height:100%;display:flex;flex-direction:column;align-items:center;gap:32px;padding:0 clamp(24px,4vw,48px) 48px;overflow:auto;color:var(--dsw-alias-label-primary);font-size:14px}
.dcm>*{width:100%;max-width:960px}
.dcm *{box-sizing:border-box}
.dcm-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:16px;padding-top:28px}[data-platform=darwin] .dcm-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.dcm-heading{min-width:0;max-width:100%}
.dcm-title{margin:0;font-size:20px;font-weight:500;line-height:28px}
.dcm-intro{display:flex;align-items:center;gap:4px;margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dcm-toolbar{display:flex;flex:none;flex-wrap:nowrap;align-items:center;justify-content:flex-end;gap:16px;white-space:nowrap}
.dcm-iconButton{display:inline-flex;flex:none;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-caption);cursor:pointer}
.dcm-iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dcm-iconButton:disabled{opacity:.5;cursor:default}
.dcm-iconButton--danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-state-error-primary)}
.dcm-tabs{margin-top:-16px;display:flex}
.dcm-tabList{width:fit-content;min-width:240px}
.dcm-fallbackTabs{display:inline-flex;gap:2px;padding:3px;border-radius:10px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
.dcm-fallbackTab{padding:4px 14px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.dcm-fallbackTab[aria-selected='true']{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:0 1px 2px var(--dsw-alias-border-l1)}
.dcm-panel{display:flex;flex-direction:column;gap:24px}
.dcm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dcm-search{flex:1 1 240px;max-width:320px;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dcm-search::placeholder{color:var(--dsw-alias-label-tertiary)}
.dcm-search:focus{border-color:var(--dsw-alias-border-l4);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.dcm-select{height:28px;max-width:240px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.dcm-scope{display:flex;flex-wrap:wrap;align-items:center;gap:18px;margin-top:-8px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dcm-scopeTab{display:inline-flex;align-items:center;gap:6px;margin-bottom:-.5px;padding:0 0 7px;border:0;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}
.dcm-scopeTab:hover{color:var(--dsw-alias-label-primary)}
.dcm-scopeTab[aria-selected='true']{border-bottom-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary);font-weight:500}
.dcm-scopeCount{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dcm-scopeTab[aria-selected='true'] .dcm-scopeCount{color:var(--dsw-alias-label-secondary)}
.dcm-scopeEnd{display:flex;align-items:center;gap:8px;margin-left:auto;padding-bottom:6px}
.dcm-group{display:flex;flex-direction:column;gap:8px}
.dcm-groupHead{display:flex;align-items:center;gap:8px}
.dcm-groupTitle{flex:none;margin:0;font-size:14px;font-weight:500;line-height:22px}
.dcm-groupCount{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.dcm-groupEnd{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0}
.dcm-cards{display:flex;flex-direction:column;gap:2px;margin:0 -8px;padding:0;list-style:none}
.dcm-card{min-width:0;border-radius:20px}
.dcm-cardHead{display:flex;align-items:center;gap:14px;width:100%;padding:8px;border:0;border-radius:20px;background:none;color:inherit;font:inherit;text-align:left}
.dcm-cardHead:not(.dcm-cardHead--static){cursor:pointer}
.dcm-cardHead:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dcm-cardHead:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dcm-cardOpen{display:flex;flex:1;align-items:center;gap:14px;min-width:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dcm-cardOpen:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:12px}
.dcm-cardIcon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:48px;height:48px;border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;color:var(--dsw-alias-label-secondary)}
.dcm-cardMain{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
.dcm-cardTitle{font-size:14px;font-weight:500;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcm-cardDesc{display:-webkit-box;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:18px;overflow-wrap:anywhere;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.dcm-cardMeta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}
.dcm-chip{padding:0 6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.dcm-flag{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap}
.dcm-cardEnd{display:flex;flex:none;align-items:center;gap:12px}
.dcm-cardArrow{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary)}
.dcm-surface{padding:14px 16px;border:.5px solid var(--dsw-alias-border-l3);border-radius:20px;background:var(--dsw-alias-bg-layer-2)}
.dcm-surface h4{margin:0 0 10px;font-size:14px;font-weight:500;line-height:22px}
.dcm-toolList{padding:2px 16px;max-height:300px;overflow:auto}
.dcm-toolRow{display:flex;align-items:center;width:100%;min-height:30px;padding:3px 6px;margin:0 -6px;border:0;border-bottom:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dcm-toolRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dcm-toolRow:last-child{border-bottom:0}
.dcm-toolRow:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dcm-toolName{font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dcm-form{display:flex;flex-direction:column;gap:12px;padding:16px;border:.5px solid var(--dsw-alias-border-l3);border-radius:20px;background:var(--dsw-alias-bg-layer-2)}
.dcm-form h4{margin:0;font-size:14px;font-weight:500;line-height:22px}
.dcm-textarea{width:100%;min-height:120px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:18px;resize:vertical;outline:none}
.dcm-textarea:focus{box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.dcm-acts{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dcm-note{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.dcm-alert{margin:0;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dcm-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer}
.dcm-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dcm-btn:disabled{opacity:.5;cursor:default}
.dcm-btn--primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
.dcm-btn--primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 86%,var(--dsw-alias-label-primary))}
.dcm-switch{display:inline-flex;flex:none;align-items:center;width:34px;height:20px;min-width:34px;padding:2px;border:0;border-radius:999px;background:var(--dsw-alias-border-l4);cursor:pointer}
.dcm-switch span{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);box-shadow:0 1px 2px var(--dsw-alias-border-l3);transition:transform .16s ease}
.dcm-switch:disabled{opacity:.5;cursor:default}
.dcm-btn:focus-visible,.dcm-iconButton:focus-visible,.dcm-switch:focus-visible,.dcm-fallbackTab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.dcm-switch[aria-checked='true']{background:var(--dsw-alias-brand-primary)}
.dcm-switch[aria-checked='true'] span{transform:translateX(14px)}
.dcm-modal.dcm-modal{position:fixed;inset:0;box-sizing:border-box;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:24px;border:0;overflow:hidden;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.dcm-modal[open]{display:flex;align-items:center;justify-content:center}
.dcm-modal::backdrop{background:var(--dsw-alias-bg-mask-1)}
.dcm-modal *{box-sizing:border-box}
.dcm-modal>.dcm-detailDialog{display:flex;flex-direction:column;width:min(720px,100%);min-width:0;min-height:0;max-height:100%;overflow:hidden;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 48px var(--dsw-alias-bg-mask-1)}
.dcm-modalBody{min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 22px 20px;scrollbar-gutter:stable}
.dcm-modalHead{display:flex;flex:none;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:20px 22px 12px}
.dcm-modalHead h4{margin:0;font-size:16px;font-weight:500;line-height:24px}
.dcm-dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0;font-size:13px;line-height:20px}
.dcm-dl dt{color:var(--dsw-alias-label-secondary)}
.dcm-dl dd{margin:0;overflow-wrap:anywhere}
.dcm-pre{max-height:46vh;margin:16px 0 0;padding:12px;overflow:auto;border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:18px;white-space:pre-wrap;overflow-wrap:anywhere}
.dcm-subHead{display:flex;align-items:center;gap:8px;margin:18px 0 0;font-size:13px;font-weight:500;line-height:20px}
.dcm-subCount{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;font-variant-numeric:tabular-nums}
.dcm-subList{display:flex;flex-direction:column;margin:6px 0 0;padding:0;list-style:none;max-height:30vh;overflow:auto;border-top:.5px solid var(--dsw-alias-border-l2)}
.dcm-subTool{padding:6px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dcm-subTool:last-child{border-bottom:0}
.dcm-issues{margin:12px 0;padding-left:20px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dcm-issues li{margin:8px 0}
.dcm-continuation{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-top:12px}
.dcm-continuation .dcm-subHead{margin:0}
.dcm-composer{display:inline-flex;align-items:center;max-width:100%;color:var(--dsw-alias-label-primary);font-size:13px}
.dcm-composerButton{display:inline-flex;align-items:center;gap:6px;max-width:260px;height:28px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;cursor:pointer}
.dcm-composerButton>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcm-composerButton[data-phase='blocked'],.dcm-composerButton[data-phase='unavailable']{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dcm-composerButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.dcm-composer .dcm-modal .dcm-acts{margin-top:16px;flex-wrap:wrap}
.dcm-modalBody>.dcm-alert{margin-top:12px}
@media(max-width:640px),(max-height:480px){.dcm-modal.dcm-modal{padding:12px}.dcm-modalHead{padding:12px 14px 10px}.dcm-modalBody{padding:0 14px 14px}.dcm-acts{flex-wrap:wrap}}
@media(max-width:640px){.dcm-search{flex-basis:100%;max-width:none}.dcm-dl{grid-template-columns:1fr;gap:4px}.dcm-dl dd{margin-bottom:8px}.dcm-toolbar{gap:8px}}`;
  const call=async params=>{
    const tab=['mcp','assistants'].includes(params.tab)?params.tab:'skills';
    if(params.method!=='POST'){
      const url=new URL('/dsh-capability-manager/api',location.origin);
      for(const[k,v]of Object.entries({...params,tab}))if(k!=='method'&&v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,v);
      const r=await fetch(url,{credentials:'same-origin',headers:{'x-dsh-capability-manager':'1'}}),p=await r.json();
      if(!r.ok||!p.ok)throw Error(p.error?.code||'REQUEST_FAILED');return p.value;
    }
    const body={...params};delete body.method;
    const r=await fetch('/dsh-capability-manager/api',{method:'POST',credentials:'same-origin',headers:{'x-dsh-capability-manager':'1','content-type':'application/json'},body:JSON.stringify({...body,tab})});
    const p=await r.json();if(!r.ok||!p.ok)throw Error(p.error?.code||'REQUEST_FAILED');return p.value;
  };
  return {inject:['slots','locale'],apply(ctx){
    for(const[locale,value]of Object.entries(dict))ctx.effect(()=>ctx.locale.register(NS,locale,value));
    const t=ctx.locale.bind(NS);
    // Local controls share only the host's public theme tokens.
    const glyph=(paths,_name,size,viewBox)=>h('svg',{width:size,height:size,viewBox:viewBox||'0 0 24 24',fill:'none','aria-hidden':'true'},paths);
    const icons={
      refresh:size=>glyph(h('path',{key:'a',d:'M19.5 12a7.5 7.5 0 1 1-2.2-5.3',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round'}),'IconRefreshOutlineRegular',size??16),
      plus:size=>glyph(h('path',{key:'a',d:'M12 5v14M5 12h14',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round'}),'IconPlusOutlineRegular',size??13),
      trash:size=>glyph(h('path',{key:'a',d:'M5 7h14M10 7V5h4v2M8 7l.8 12h6.4L16 7',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round'}),'IconTrashOutlineRegular',size??16),
      chevron:size=>glyph(h('path',{key:'a',d:'M10 6l6 6-6 6',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round'}),'IconChevronRightOutlineRegular',size??16)
    };
    // Official skill glyph: a text page plus a sparkle, so the row reads as a skill
    // rather than a rating. Same geometry as the shipped IconSkillOutline set.
    const skillPaths=h(React.Fragment,null,
      h('path',{key:'a',d:'M4.57788 5.77124H10.7029',stroke:'currentColor',strokeWidth:1,strokeLinecap:'round'}),
      h('path',{key:'b',d:'M4.57788 8.89819H7.91879',stroke:'currentColor',strokeWidth:1,strokeLinecap:'round'}),
      h('path',{key:'c',d:'M12.1404 1.19446C12.9442 1.19446 13.6404 1.81999 13.6404 2.64465V8.89856H12.6404V2.64465C12.6404 2.42015 12.4411 2.19446 12.1404 2.19446H3.14038C2.83968 2.19446 2.64038 2.42015 2.64038 2.64465V13.0929C2.64082 13.3172 2.84001 13.5421 3.14038 13.5421H8.88159V14.5421H3.14038C2.33675 14.5421 1.6408 13.9172 1.64038 13.0929V2.64465C1.64038 1.81999 2.33651 1.19446 3.14038 1.19446H12.1404Z',fill:'currentColor'}),
      h('path',{key:'d',d:'M12.0051 15.1056C12.0051 13.6395 10.8166 12.451 9.35059 12.451C10.8166 12.451 12.0051 11.2626 12.0051 9.79651C12.0051 11.2626 13.1936 12.451 14.6597 12.451C13.1936 12.451 12.0051 13.6395 12.0051 15.1056Z',stroke:'currentColor',strokeWidth:1,strokeLinejoin:'round'}));
    const skillGlyph=glyph(skillPaths,'IconSkillOutlineRegular',22,'0 0 17 17');
    const serverGlyph=h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none','aria-hidden':'true'},
      h('rect',{x:4.2,y:4.6,width:15.6,height:6.2,rx:2,stroke:'currentColor',strokeWidth:1.4}),
      h('rect',{x:4.2,y:13.2,width:15.6,height:6.2,rx:2,stroke:'currentColor',strokeWidth:1.4}),
      h('circle',{cx:7.4,cy:7.7,r:.9,fill:'currentColor'}),
      h('circle',{cx:7.4,cy:16.3,r:.9,fill:'currentColor'}));
    const externalGlyph=h('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none','aria-hidden':'true'},
      h('path',{d:'M10 6.5H7.2A2.2 2.2 0 0 0 5 8.7v8.1A2.2 2.2 0 0 0 7.2 19h8.1a2.2 2.2 0 0 0 2.2-2.2V14',stroke:'currentColor',strokeWidth:1.4,strokeLinecap:'round'}),
      h('path',{d:'M13.4 5H19v5.6M18.4 5.6l-7 7',stroke:'currentColor',strokeWidth:1.4,strokeLinecap:'round',strokeLinejoin:'round'}));
    const segTabs=(label,value,onChange,items,disabled=false)=>h('div',{className:'dcm-fallbackTabs',role:'tablist','aria-label':label},...items.map((item,index)=>h('button',{key:item.value,id:`cap-${item.value}-tab`,type:'button',role:'tab','aria-selected':value===item.value,'aria-controls':`cap-${item.value}-panel`,tabIndex:value===item.value?0:-1,disabled,className:'dcm-fallbackTab',onClick:()=>onChange(item.value),onKeyDown:event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||disabled)return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:items.length-1))%items.length;onChange(items[target].value);event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[target]?.focus();}},item.label)));
    const primaryBtn=(label,onClick,disabled,icon)=>h('button',{type:'button',className:'dcm-btn dcm-btn--primary',disabled,onClick},icon,label);
    const ghostBtn=(label,onClick,disabled)=>h('button',{type:'button',className:'dcm-btn',disabled,onClick},label);
    const switchEl=(checked,label,disabled,onChange)=>h('button',{type:'button',role:'switch','aria-checked':!!checked,'aria-label':label,className:'dcm-switch',disabled,onClick:()=>onChange(!checked)},h('span'));
    function Modal({title,busy=false,onClose,children}){
      const ref=React.useRef(null),latest=React.useRef({busy,onClose});latest.current={busy,onClose};
      React.useLayoutEffect(()=>{
        const node=ref.current,previous=document.activeElement;
        // Browser top layer escapes the composer's transformed containing block,
        // while retaining this component's inherited tokens and React ownership.
        node.showModal();
        const cancel=event=>{event.preventDefault();if(!latest.current.busy)latest.current.onClose();};
        node.addEventListener('cancel',cancel);
        const controls=()=>[...node.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(item=>!item.disabled&&(!item.hasAttribute('tabindex')||item.tabIndex>=0)&&!item.hidden);
        (controls()[0]??node).focus();
        const keydown=event=>{
          if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!latest.current.busy)latest.current.onClose();}
          if(event.key==='Tab'){
            const items=controls(),first=items[0]??node,last=items.at(-1)??node;
            if(!items.length||event.shiftKey&&(document.activeElement===first||!node.contains(document.activeElement))||!event.shiftKey&&(document.activeElement===last||!node.contains(document.activeElement))){event.preventDefault();(event.shiftKey?last:first).focus();}
          }
        };
        const focusin=event=>{if(!node.contains(event.target))(controls()[0]??node).focus();};
        document.addEventListener('keydown',keydown,true);document.addEventListener('focusin',focusin);
        return()=>{document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focusin);node.removeEventListener('cancel',cancel);node.close();if(previous?.isConnected)previous.focus?.();};
      },[]);
      return h('dialog',{ref,tabIndex:-1,className:'dcm-modal',role:'dialog','aria-modal':true,'aria-label':title,'aria-busy':busy,onClick:event=>{if(!busy&&event.target===event.currentTarget)onClose();}},h('section',{className:'dcm-detailDialog'},h('div',{className:'dcm-modalHead'},h('h4',null,title),ghostBtn(t('close'),onClose,busy)),h('div',{className:'dcm-modalBody'},children)));
    }
    const errorText=error=>`${t(['ASSISTANT_NOT_FOUND','PACKAGE_UNAVAILABLE'].includes(error?.message)?'packageUnavailable':error?.message==='ASSISTANT_IDENTITY_CHANGED'?'identityChanged':'failed')}${/^[A-Z_]+$/.test(error?.message)?` (${error.message})`:''}`;
    const sameIdentity=(left,right)=>!!left&&!!right&&['assistantId','packageName','packageVersion','contentDigest','requiredPreset'].every(key=>Object.hasOwn(left,key)&&Object.hasOwn(right,key)&&left[key]===right[key]);
    const openPlugins=()=>{const layout=ctx.get('layout');if(!layout)throw Error('PLUGIN_MANAGER_UNAVAILABLE');layout.selectPanel('plugins');};
    const issuesView=issues=>issues?.length?h('ul',{className:'dcm-issues'},...issues.map((issue,index)=>h('li',{key:index},h('span',null,issue.message||issue.code),issue.capability&&h('span',{className:'dcm-chip'},issue.capability),issue.remediation&&h('p',{className:'dcm-note'},issue.remediation)))):null;
    function Continuation({text}){
      const [feedback,setFeedback]=React.useState('');
      React.useEffect(()=>setFeedback(''),[text]);
      if(!text)return null;
      return h('div',{className:'dcm-continuation'},h('h5',{className:'dcm-subHead'},t('continuation')),h('textarea',{className:'dcm-textarea',readOnly:true,value:text,'aria-label':t('continuation')}),ghostBtn(t('copyContinuation'),async()=>{try{await navigator.clipboard.writeText(text);setFeedback(t('copied'));}catch{setFeedback(t('copyFailed'));}}),feedback&&h('p',{role:'status',className:'dcm-note'},feedback));
    }
    const identityRows=identity=>detailRows([[t('assistantIdentity'),identity.assistantId],[t('packageName'),identity.packageName],[t('version'),identity.packageVersion],[t('digest'),identity.contentDigest],identity.requiredPreset?[t('requiredPreset'),identity.requiredPreset]:null]);
    const bindingBody=binding=>h(React.Fragment,null,detailRows([[t('status'),t(binding.phase)]]),binding.identity&&identityRows(binding.identity),binding.reason&&h('p',{role:'alert',className:'dcm-alert'},binding.reason),h(Continuation,{text:binding.continuationPrompt}));
    const assistantBody=value=>h(React.Fragment,null,detailRows([[t('status'),t(value.readiness.status)],[t('packageName'),value.manifest.package.name],[t('version'),value.manifest.package.version],[t('digest'),value.manifest.package.contentDigest],value.manifest.requires?.agentPreset?[t('requiredPreset'),value.manifest.requires.agentPreset]:null]),issuesView(value.readiness.issues),h('h5',{className:'dcm-subHead'},t('capabilities')),h('ul',{className:'dcm-subList'},...value.manifest.capabilities.map(capability=>h('li',{key:capability.id,className:'dcm-subTool'},capability.title))));
    const detailRows=pairs=>h('dl',{className:'dcm-dl'},...pairs.filter(Boolean).map((pair,index)=>h(React.Fragment,{key:index},h('dt',null,pair[0]),h('dd',null,pair[1]))));
    const detailTitle=entry=>entry.kind==='assistant'?entry.value.manifest.name:entry.kind==='confirm'?t(entry.operation==='purge'?'purgeTitle':'deleteTitle'):entry.kind==='server'?entry.value.serverName:entry.value.name||entry.value.metadata?.name||t('files');
    const fileList=files=>h('ul',{className:'dcm-subList'},...files.map((file,index)=>h('li',{className:'dcm-subTool',key:index},file.absolutePath||file.path||file.relative||'·')));
    const checkLabel=check=>{
      if(!check)return t('unknown');
      if(check.state==='pending')return t('checking');
      if(check.state==='ok')return t('reachable');
      if(check.state==='fail')return t('unreachable');
      if(check.state==='disabled')return t('notProbed');
      if(check.state==='readonly')return t('readonlyProbe');
      return t('checkFailed');
    };
    const detailBody=(entry,extra)=>{
      if(entry.kind==='assistant')return h(React.Fragment,null,assistantBody(entry.value),h('div',{className:'dcm-acts'},ghostBtn(t('managePlugins'),extra.manage,extra.busy)),extra.error&&h('p',{role:'alert',className:'dcm-alert'},extra.error));
      if(entry.kind==='confirm')return h(React.Fragment,null,h('p',{className:'dcm-note'},t(entry.operation==='purge'?'purgeNote':'deleteNote')),fileList(entry.value.summary?.affectedPaths?.map(path=>({path}))??entry.value.files??[]),h('div',{className:'dcm-acts'},ghostBtn(t('cancel'),extra.cancel,extra.busy),ghostBtn(t(entry.operation==='purge'?'purgeFile':'deleteSkill'),extra.commit,extra.busy)),extra.error&&h('p',{role:'alert',className:'dcm-alert'},extra.error));
      if(entry.kind==='recovery')return h(React.Fragment,null,
        detailRows([[t('deletedAt'),entry.value.deletedAt?new Date(entry.value.deletedAt).toLocaleString():'—']]),
        fileList(entry.value.inventory??[]),
        entry.value.raw?h('pre',{className:'dcm-pre'},entry.value.raw):null,
        h('div',{className:'dcm-acts'},ghostBtn(t('openFolder'),extra.reveal,extra.busy||entry.value.readOnly),ghostBtn(t('purgeFile'),extra.remove,extra.busy||entry.value.readOnly)),
        extra.error&&h('p',{role:'alert',className:'dcm-alert'},extra.error));
      if(entry.kind==='server'){const server=entry.value;
        const check=extra?.check??null;
        const prefix=`mcp__${server.serverName}__`;
        const owned=(extra?.tools??[]).filter(tool=>String(tool.name).startsWith(prefix));
        return h(React.Fragment,null,
          detailRows([[t('serverName'),server.serverName],[t('transport'),server.transport],[t('endpoint'),server.endpoint],
            [t('state'),t(server.enabled?'enabled':'disabled')],
            [t('source'),server.source==='external'?t('externalServers'):t('configuredServers')],
            server.phase?[t('phase'),server.phase]:null,
            [t('connection'),checkLabel(check)],
            check?.at?[t('checkedAt'),new Date(check.at).toLocaleString()]:null,
            check?.method?[t('probeMethod'),check.method]:null,
            [t('headerCount'),String(server.headerCount??0)],[t('envCount'),String(server.envCount??0)],[t('argumentCount'),String(server.argumentCount??0)]]),
          check?.state==='error'&&check.message?h('p',{className:'dcm-note'},check.message):null,
          h('h5',{className:'dcm-subHead'},t('serverTools'),h('span',{className:'dcm-subCount'},owned.length)),
          owned.length
            ?h('ul',{className:'dcm-subList'},...owned.map(tool=>h('li',{className:'dcm-subTool',key:tool.name},tool.name)))
            :h('p',{className:'dcm-note'},t('noServerTools')),
          );
      }
      if(entry.kind==='tool'){const parts=String(entry.value.name).split('__');
        return h(React.Fragment,null,
          detailRows([[t('toolName'),entry.value.name],[t('toolServer'),parts.length>2?parts[1]:t('unknown')],[t('toolLocal'),parts.length>2?parts.slice(2).join('__'):t('unknown')]]),
          );
      }
      const detail=entry.value;
      return h(React.Fragment,null,
        detailRows([[t('source'),detail.source],[t('provider'),detail.provider],
          detail.path?[t('path'),detail.path]:null,
          [t('model'),t(detail.invocation?.modelInvocable?'yes':'no')],
          [t('user'),t(detail.invocation?.userInvocable?'yes':'no')]]),
        h('pre',{className:'dcm-pre'},detail.content??''),
        detail.management&&!detail.management.readOnly?h('div',{className:'dcm-acts'},ghostBtn(t('openFolder'),extra.reveal,extra.busy),ghostBtn(t('deleteSkill'),extra.remove,extra.busy)):null,
        extra.error&&h('p',{role:'alert',className:'dcm-alert'},extra.error));
    };
    function Panel(){
      React.useSyncExternalStore(cb=>ctx.locale.subscribe(cb),()=>ctx.locale.getSnapshot());
      const [tab,setTab]=React.useState('skills');
      const [skills,setSkills]=React.useState(null),[local,setLocal]=React.useState(null),[mcp,setMcp]=React.useState(null),[assistants,setAssistants]=React.useState(null);
      const [session,setSession]=React.useState(''),[query,setQuery]=React.useState('');
      const [projectId,setProjectId]=React.useState(''),[scope,setScope]=React.useState('');
      const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
      const [detail,setDetail]=React.useState(null),[form,setForm]=React.useState(null),[json,setJson]=React.useState(''),[check,setCheck]=React.useState(null),[fileError,setFileError]=React.useState('');
      const alive=React.useRef(true),seq=React.useRef(0),checkSeq=React.useRef(0);
      const run=async work=>{const id=++seq.current;setBusy(true);setError('');try{const value=await work();if(alive.current&&id===seq.current)return value;}catch(e){if(alive.current&&id===seq.current)setError(t('failed')+(e.message&&/^[A-Z_]+$/.test(e.message)?` (${e.message})`:''));}finally{if(alive.current&&id===seq.current)setBusy(false);}};
      const load=()=>run(async()=>{
        if(tab==='skills'){setDetail(null);
          const [base,projects]=await Promise.all([call({action:'list'}),call({action:'projects'})]);
          if(!alive.current)return;
          const grouped=await Promise.all(projects.map(async project=>({...project,skills:(await call({action:'list',cwd:project.path})).skills??[]})));
          if(!alive.current)return;
          const localSnapshots=await Promise.all([undefined,...projects.map(project=>project.path)].map(async cwd=>{try{return {...await call({action:'local',cwd}),cwd};}catch{return {cwd,unavailable:true};}}));if(!alive.current)return;
          const mergeRows=key=>[...new Map(localSnapshots.flatMap(snapshot=>(snapshot[key]??[]).map(item=>({...item,cwd:snapshot.cwd}))).map(item=>[`${item.rootId}:${item.id??item.path}`,item])).values()];
          const l={roots:[...new Map(localSnapshots.flatMap(snapshot=>snapshot.roots??[]).map(root=>[root.id,root])).values()],items:mergeRows('items'),recovery:mergeRows('recovery').filter(item=>!['trashed','purged','restored'].includes(item.status)),unavailable:localSnapshots.some(snapshot=>snapshot.unavailable)};
          setSkills({...base,projects:grouped});setLocal(l);
          setProjectId(current=>grouped.some(project=>project.id===current)?current:grouped[0]?.id??'');}
        else if(tab==='assistants'){const value=await call({tab:'assistants',action:'list'});if(!alive.current)return;setAssistants(value);}
        else{const value=await call({tab:'mcp'});if(!alive.current)return;setMcp(value);}
      });
      React.useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;seq.current++;};},[tab,session]);
      const mutateMcp=body=>{void run(async()=>{await call({method:'POST',tab:'mcp',confirm:true,revision:mcp?.revision,...body});if(alive.current)await load();});};
      const matches=item=>!query||`${item.name} ${item.description??''}`.toLowerCase().includes(query.toLowerCase());
      const rows=(skills?.skills??[]).filter(matches);
      const isProject=item=>String(item.source??'').startsWith('project-');
      const projectGroups=(skills?.projects??[]).map(project=>({...project,rows:(project.skills??[]).filter(item=>isProject(item)&&matches(item))}));
      const globalRows=rows.filter(item=>!isProject(item)&&item.source!=='bundled');
      const bundledRows=rows.filter(item=>item.source==='bundled');
      const selectedProject=projectGroups.find(project=>project.id===projectId)??projectGroups[0];
      const scopes=[
        {id:'project',label:t('projectLevel'),count:selectedProject?.rows.length??0},
        {id:'global',label:t('globalLevel'),count:globalRows.length},
        {id:'bundled',label:t('bundledLevel'),count:bundledRows.length},
        {id:'recovery',label:t('recoveryZone'),count:local?.recovery?.length??0},
      ];
      const activeScope=scope==='local'?'project':scope||(scopes.find(entry=>entry.count>0)?.id??'project');
      const activeRows=activeScope==='project'?(selectedProject?.rows??[]):activeScope==='global'?globalRows:activeScope==='bundled'?bundledRows:(local?.recovery??[]).filter(matches);
      const group=(key,title,count,body,extra)=>h('section',{className:'dcm-group',key},
        h('div',{className:'dcm-groupHead'},h('h4',{className:'dcm-groupTitle'},title),h('span',{className:'dcm-groupCount'},count),extra&&h('div',{className:'dcm-groupEnd'},extra)),
        body);
      const cards=(items,render)=>(items?.length?h('ul',{className:'dcm-cards'},...items.map(render)):h('p',{className:'dcm-note'},t('empty')));
      const openDetail=item=>run(async()=>{const cwd=isProject(item)?selectedProject?.path:undefined;const value=await call({action:'detail',name:item.name,sessionId:session||undefined,cwd});if(alive.current){setFileError('');setDetail(value.skill?{kind:'skill',value:value.skill,cwd}:null);}});
      const fileWork=async work=>{setBusy(true);setFileError('');try{await work();}catch(e){if(alive.current)setFileError(t('deleteFailed')+` (${e.message||'REQUEST_FAILED'})`);}finally{if(alive.current)setBusy(false);}};
      const fileTarget=entry=>({...(entry.kind==='skill'?entry.value.management:{rootId:entry.value.rootId,path:entry.value.path,recoveryId:entry.value.recoveryId??entry.value.id}),cwd:entry.cwd});
      const revealFile=()=>void fileWork(async()=>{await call({method:'POST',action:'reveal',...fileTarget(detail)});});
      const previewDelete=()=>void fileWork(async()=>{const previous=detail,operation=previous.kind==='recovery'?'purge':'remove';const value=await call({method:'POST',action:'preview',operation,...fileTarget(previous)});if(alive.current)setDetail({kind:'confirm',operation,value,cwd:previous.cwd,previous});});
      const commitDelete=()=>void fileWork(async()=>{await call({method:'POST',action:'commit',previewId:detail.value.previewId,confirm:true,cwd:detail.cwd});if(alive.current){setDetail(null);await load();}});
      const openRecovery=item=>void fileWork(async()=>{const value=await call({action:'recoveryDetail',rootId:item.rootId,recoveryId:item.id??item.recoveryId,cwd:item.cwd});if(alive.current)setDetail({kind:'recovery',value:{...value,rootId:item.rootId,id:item.id??item.recoveryId},cwd:item.cwd});});
      const detailExtras={manage:()=>void fileWork(openPlugins),check,tools:mcp?.tools,busy,error:fileError,reveal:revealFile,remove:previewDelete,commit:commitDelete,cancel:()=>{setFileError('');setDetail(detail.previous);}};
      const skillRow=item=>h('li',{className:'dcm-card',key:`${item.source}:${item.name}`},
        h('button',{type:'button',className:'dcm-cardHead',disabled:busy,onClick:()=>openDetail(item),'aria-label':`${t('open')} · ${item.name}`},
          h('span',{className:'dcm-cardIcon'},skillGlyph),
          h('span',{className:'dcm-cardMain'},
            h('span',{className:'dcm-cardTitle'},item.name),
            item.description&&h('span',{className:'dcm-cardDesc'},item.description),
            h('span',{className:'dcm-cardMeta'},
              h('span',{className:'dcm-chip'},item.source),
              h('span',{className:'dcm-flag'},`${t('model')} ${t(item.invocation?.modelInvocable?'yes':'no')}`),
              h('span',{className:'dcm-flag'},`${t('user')} ${t(item.invocation?.userInvocable?'yes':'no')}`))),
          h('span',{className:'dcm-cardEnd'},h('span',{className:'dcm-cardArrow'},icons.chevron(16)))));
      const recoveryRow=item=>h('li',{className:'dcm-card',key:`${item.rootId}:${item.recoveryId||item.id}`},
        h('button',{type:'button',className:'dcm-cardHead',disabled:busy,onClick:()=>openRecovery(item)},
          h('span',{className:'dcm-cardIcon'},skillGlyph),
          h('span',{className:'dcm-cardMain'},h('span',{className:'dcm-cardTitle'},item.name||t('unnamed')),h('span',{className:'dcm-cardDesc'},item.deletedAt?`${t('deletedAt')} · ${new Date(item.deletedAt).toLocaleString()}`:'')),
          h('span',{className:'dcm-cardEnd'},icons.chevron(16))));
      const activeRow=item=>activeScope==='recovery'?recoveryRow(item):skillRow(item);
      const openServer=(item,external)=>{
        setDetail({kind:'server',value:item});
        if(external){setCheck({state:'readonly'});return;}
        if(!item.enabled){setCheck({state:'disabled'});return;}
        // The list projection carries no live state; the manager owns the probe,
        // so ask it once when the owner opens the row.
        const seq=++checkSeq.current;
        setCheck({state:'pending'});
        call({method:'POST',tab:'mcp',action:'check',serverName:item.serverName,revision:mcp?.revision})
          .then(value=>{if(alive.current&&seq===checkSeq.current)setCheck({state:value?.successful?'ok':'fail',at:value?.at,method:value?.method});})
          .catch(error=>{if(alive.current&&seq===checkSeq.current)setCheck({state:'error',message:String(error?.message||error)});});
      };
      const mcpRow=(item,external)=>h('li',{className:'dcm-card',key:`${external}:${item.serverName}`},
        h('div',{className:'dcm-cardHead'},
          h('button',{type:'button',className:'dcm-cardOpen',onClick:()=>openServer(item,external),'aria-label':`${t('open')} · ${item.serverName}`},
            h('span',{className:'dcm-cardIcon'},external?externalGlyph:serverGlyph),
            h('span',{className:'dcm-cardMain'},
              h('span',{className:'dcm-cardTitle'},item.serverName),
              h('span',{className:'dcm-cardDesc'},[item.transport,item.endpoint].filter(Boolean).join(' · '))),
            h('span',{className:'dcm-cardArrow'},icons.chevron(16))),
          h('span',{className:'dcm-cardEnd'},external
            ?h('span',{className:'dcm-chip'},t('readOnly'))
            :h(React.Fragment,null,
              switchEl(!!item.enabled,item.serverName,busy,enabled=>mutateMcp({action:'toggle',serverName:item.serverName,enabled})),
              h('button',{type:'button',className:'dcm-iconButton dcm-iconButton--danger',disabled:busy,'aria-label':`${t('removeServer')} · ${item.serverName}`,onClick:()=>mutateMcp({action:'remove',serverName:item.serverName})},icons.trash(16))))));
      const assistantRow=item=>h('li',{className:'dcm-card',key:item.id},h('button',{type:'button',className:'dcm-cardHead',disabled:busy,'aria-label':`${t('detail')} · ${item.name}`,onClick:()=>void run(async()=>{const value=await call({tab:'assistants',action:'detail',id:item.id});if(alive.current){setFileError('');setDetail({kind:'assistant',value});}})},h('span',{className:'dcm-cardIcon'},skillGlyph),h('span',{className:'dcm-cardMain'},h('span',{className:'dcm-cardTitle'},item.name),h('span',{className:'dcm-cardDesc'},item.description),h('span',{className:'dcm-cardMeta'},h('span',{className:'dcm-chip'},t(item.readiness.status)),h('span',{className:'dcm-flag'},`${item.package.name} · ${item.package.version}`))),icons.chevron(16)));
      const toolbar=h('div',{className:'dcm-toolbar'},
        h('button',{type:'button',className:'dcm-iconButton','aria-label':t('refresh'),'aria-busy':busy,disabled:busy,onClick:load},icons.refresh(16)),
        tab==='mcp'&&!form&&primaryBtn(t('addServer'),()=>setForm({kind:'server'}),busy,icons.plus(13)),
        tab==='assistants'&&primaryBtn(t('installAssistant'),()=>void run(openPlugins),busy,icons.plus(13)));
      return h('section',{className:'dcm'},h('style',null,css),
        h('header',{className:'dcm-head'},
          h('div',{className:'dcm-heading'},h('h3',{className:'dcm-title'},t('title'))),
          toolbar),
        h('div',{className:'dcm-tabs'},segTabs(t('title'),tab,value=>{if(busy)return;setTab(value);setDetail(null);setForm(null);},[{value:'skills',label:t('skills')},{value:'mcp',label:t('mcp')},{value:'assistants',label:t('assistants')}],busy)),
        error&&h('p',{role:'alert',className:'dcm-alert'},error),
        tab==='assistants'&&h('div',{className:'dcm-panel',id:'cap-assistants-panel',role:'tabpanel','aria-labelledby':'cap-assistants-tab'},assistants?.available===false&&h('p',{role:'alert',className:'dcm-alert'},t('bindingUnavailable')),issuesView(assistants?.issues),assistants?assistants.assistants.length?h('ul',{className:'dcm-cards'},...assistants.assistants.map(assistantRow)):h('p',{className:'dcm-note'},t('noAssistants')):h('p',{role:'status',className:'dcm-note'},t('loading'))),
        tab==='skills'&&h('div',{className:'dcm-panel',id:'cap-skills-panel',role:'tabpanel','aria-labelledby':'cap-skills-tab'},
          h('div',{className:'dcm-bar'},h('input',{type:'search',className:'dcm-search',value:query,'aria-label':t('search'),placeholder:t('search'),onChange:e=>setQuery(e.target.value)})),
          skills?.complete===false&&h('p',{className:'dcm-note'},t('partial')),
          local?.unavailable&&h('p',{className:'dcm-note'},t('localUnavailable')),
          fileError&&!detail&&h('p',{role:'alert',className:'dcm-alert'},fileError),
          h(React.Fragment,null,
              h('div',{className:'dcm-scope',role:'tablist','aria-label':t('skills')},
                ...scopes.map(entry=>h('button',{key:entry.id,type:'button',role:'tab','aria-selected':activeScope===entry.id,className:'dcm-scopeTab',disabled:busy,onClick:()=>{setScope(entry.id);setDetail(null);}},entry.label,h('span',{className:'dcm-scopeCount'},entry.count))),
                activeScope==='project'&&projectGroups.length?h('div',{className:'dcm-scopeEnd'},h('select',{className:'dcm-select','aria-label':t('project'),value:selectedProject?.id??'',disabled:busy,onChange:e=>{setProjectId(e.target.value);setDetail(null);}},...projectGroups.map(project=>h('option',{key:project.id,value:project.id},`${project.title} (${project.rows.length})`)))):null),
              activeRows.length?h('ul',{className:'dcm-cards'},...activeRows.map(activeRow)):h('p',{className:'dcm-note'},activeScope==='project'?t('projEmpty'):t('empty'))),
          ),
        
        tab==='mcp'&&h('div',{className:'dcm-panel',id:'cap-mcp-panel',role:'tabpanel','aria-labelledby':'cap-mcp-tab'},
          form?.kind==='server'&&h('section',{className:'dcm-form'},h('h4',null,t('addServerForm')),
            h('textarea',{className:'dcm-textarea',value:json,'aria-label':t('jsonConfig'),placeholder:'{"mcpServers":{"name":{"type":"http","url":"https://…"}}}',onChange:e=>setJson(e.target.value)}),
            h('div',{className:'dcm-acts'},
              ghostBtn(t('cancel'),()=>setForm(null),busy),
              primaryBtn(t('connect'),()=>{void run(async()=>{await call({method:'POST',tab:'mcp',action:'import',text:json,enable:true,confirm:true,revision:mcp?.revision});if(!alive.current)return;setForm(null);setJson('');await load();});},busy||!json))),
          group('servers',t('configuredServers'),mcp?.servers?.length??0,
            mcp?.servers?.length?h('ul',{className:'dcm-cards'},...mcp.servers.map(item=>mcpRow(item,false))):h('p',{className:'dcm-note'},t('noServers'))),
          mcp?.external?.length?group('external',t('externalServers'),mcp.external.length,h('ul',{className:'dcm-cards'},...mcp.external.map(item=>mcpRow(item,true)))):null,
          mcp&&!mcp.tools?.length&&h('p',{className:'dcm-note'},t('noTools')),
          mcp?.tools?.length?group('tools',t('registeredTools'),mcp.tools.length,
            h('div',{className:'dcm-surface dcm-toolList'},...mcp.tools.map(item=>h('button',{type:'button',className:'dcm-toolRow',key:item.name,onClick:()=>setDetail({kind:'tool',value:item}),'aria-label':`${t('open')} · ${item.name}`},h('span',{className:'dcm-toolName'},item.name))))):null),
        detail&&h(Modal,{busy,onClose:()=>{if(!busy)setDetail(null);},title:detailTitle(detail)},detailBody(detail,detailExtras)),
      );
    }
    function Composer({sessionId}){return h(AssistantControl,{key:sessionId,sessionId});}
    function AssistantControl({sessionId}){
      React.useSyncExternalStore(cb=>ctx.locale.subscribe(cb),()=>ctx.locale.getSnapshot());
      const [binding,setBinding]=React.useState(null),[items,setItems]=React.useState(null),[selected,setSelected]=React.useState(null),[preview,setPreview]=React.useState(null);
      const [open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[statusError,setStatusError]=React.useState(false);
      const alive=React.useRef(true),sequence=React.useRef(0),pending=React.useRef(false);
      const execute=async work=>{
        if(pending.current)return;
        pending.current=true;const seq=++sequence.current;setBusy(true);setError('');
        const current=()=>alive.current&&sequence.current===seq;
        try{await work(current);}catch(error){if(current())setError(errorText(error));}finally{pending.current=false;if(current())setBusy(false);}
      };
      const refresh=()=>execute(async current=>{try{const value=await call({tab:'assistants',action:'binding',sessionId});if(current()){setBinding(value);setStatusError(false);}}catch(error){if(current())setStatusError(true);throw error;}});
      React.useEffect(()=>{alive.current=true;void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{alive.current=false;sequence.current++;window.removeEventListener('focus',focus);};},[sessionId]);
      const inspect=()=>{setOpen(true);setPreview(null);void execute(async current=>{
        let value;try{value=await call({tab:'assistants',action:'list',sessionId});}catch(error){if(current())setStatusError(true);throw error;}if(!current())return;
        setItems(value);setBinding(value.binding);setStatusError(false);
        if(value.binding?.identity){try{const detail=await call({tab:'assistants',action:'detail',id:value.binding.identity.assistantId,sessionId});if(current())setSelected(detail);}catch(error){if(current()){setSelected(null);setError(errorText(error));}}}
      });};
      const select=id=>void execute(async current=>{
        const expectedIdentity=binding?.identity;
        setPreview(null);
        const value=await call({tab:'assistants',method:'POST',action:'previewBind',sessionId,id});
        if(!current())return;
        if(expectedIdentity&&(!sameIdentity(expectedIdentity,value.identity)||!sameIdentity(expectedIdentity,value.binding?.identity)||value.id!==expectedIdentity.assistantId))throw Error('ASSISTANT_IDENTITY_CHANGED');
        setPreview({...value,retryIdentity:expectedIdentity??null});setBinding(value.binding);setStatusError(false);
      });
      const confirm=()=>void execute(async current=>{
        if(!preview||statusError||preview.canSelect!==true)return;
        if(preview.retryIdentity&&(!sameIdentity(preview.retryIdentity,preview.identity)||!sameIdentity(preview.retryIdentity,binding?.identity)||preview.id!==preview.retryIdentity.assistantId))throw Error('ASSISTANT_IDENTITY_CHANGED');
        try{const value=await call({tab:'assistants',method:'POST',action:'bind',sessionId,id:preview.id,revision:preview.revision,confirm:true});if(current()){setBinding(value);setPreview(null);setStatusError(false);}}
        catch(error){if(current())setPreview(null);try{const value=await call({tab:'assistants',action:'binding',sessionId});if(current()){setBinding(value);setStatusError(false);}}catch{if(current())setStatusError(true);}throw error;}
      });
      const phase=statusError?'unavailable':binding?.phase??'loading';
      const selectedName=selected?.manifest.name??items?.assistants.find(item=>item.id===binding?.identity?.assistantId)?.name??binding?.identity?.assistantId;
      const label=binding?.identity?`${selectedName} · ${t(phase)}`:phase==='unbound'?t('selectAssistant'):`${t('assistants')} · ${t(phase)}`;
      const previewBody=preview&&h(React.Fragment,null,
        identityRows(preview.identity),
        detailRows([[t('currentPreset'),preview.currentPreset??'—'],[t('requiredPreset'),preview.requiredPreset??'—']]),
        issuesView(preview.issues),
        preview.currentPreset!==preview.requiredPreset&&preview.requiredPreset&&preview.canBind&&h('p',{role:'status',className:'dcm-note'},t('selectPreset')),
        !preview.canBind&&h('p',{role:'alert',className:'dcm-alert'},t('blockedSelection')),
        h(Continuation,{text:preview.continuationPrompt}),
        h('div',{className:'dcm-acts'},ghostBtn(t('cancel'),()=>setPreview(null),busy),primaryBtn(t(preview.retryIdentity?'confirmRetry':'confirmAssistant'),confirm,busy||statusError||preview.canSelect!==true||!!preview.retryIdentity&&(!sameIdentity(preview.retryIdentity,preview.identity)||!sameIdentity(preview.retryIdentity,binding?.identity)))));
      const choices=h(React.Fragment,null,
        items?.available===false&&h('p',{role:'alert',className:'dcm-alert'},t('bindingUnavailable')),
        issuesView(items?.issues),
        items?.assistants.length?h('ul',{className:'dcm-cards'},...items.assistants.map(item=>
          h('li',{key:item.id,className:'dcm-card'},
            h('button',{type:'button',className:'dcm-cardHead',disabled:busy||statusError||!items.available,'aria-label':`${t('selectAssistant')} · ${item.name}`,onClick:()=>select(item.id)},
              h('span',{className:'dcm-cardMain'},h('span',{className:'dcm-cardTitle'},item.name),
                h('span',{className:'dcm-cardDesc'},item.description),
                h('span',{className:'dcm-cardMeta'},h('span',{className:'dcm-chip'},t(item.readiness.status))))))))
          :h('p',{className:'dcm-note'},busy?t('loading'):t('noAssistants')),
        h('div',{className:'dcm-acts'},ghostBtn(t('refresh'),inspect,busy),ghostBtn(t('installAssistant'),()=>void execute(openPlugins),busy)));
      const locked=binding&&(binding.phase!=='unbound'||binding.identity);
      return h('div',{className:'dcm-composer'},h('style',null,css),
        h('button',{type:'button',className:'dcm-composerButton','data-phase':phase,'aria-label':label,'aria-haspopup':'dialog','aria-expanded':open,'aria-busy':busy,disabled:busy,onClick:inspect},h('span',{'aria-live':'polite'},label)),
        open&&h(Modal,{title:binding?.identity?t('selectedAssistant'):t('selectAssistant'),busy,onClose:()=>{setOpen(false);setPreview(null);}},
          error&&h('p',{role:'alert',className:'dcm-alert'},error),
          !binding&&h(React.Fragment,null,h('p',{role:'status',className:'dcm-note'},busy?t('loading'):t('bindingUnavailable')),h('div',{className:'dcm-acts'},ghostBtn(t('refresh'),inspect,busy))),
          locked?h(React.Fragment,null,bindingBody(binding),preview?previewBody:h(React.Fragment,null,selected&&assistantBody(selected),h('div',{className:'dcm-acts'},binding.phase==='blocked'&&binding.identity&&ghostBtn(t('retry'),()=>select(binding.identity.assistantId),busy||statusError),ghostBtn(t('refresh'),refresh,busy),ghostBtn(t('managePlugins'),()=>void execute(openPlugins),busy)))):null,
          binding&&!locked&&(preview?previewBody:choices)),
        !open&&error&&h('span',{role:'alert',className:'dcm-alert'},error));
    }
    ctx.effect(()=>ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'dsh-assistants',order:10,label:()=>t('assistants')},Composer)));
    const Icon=({size=20})=>glyph(skillPaths,'IconSkillOutlineRegular',size,'0 0 17 17');
    ctx.effect(()=>ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:NS,order:1,label:()=>t('title')},Icon)));
    ctx.effect(()=>ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:NS},Panel)));
  }};
}});
