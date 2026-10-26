// Embedded in the standalone HTML. Only the public project key belongs here.
var AccountAuth = (() => {
  const R=Se(), h=R.createElement, Context=R.createContext(null);
  const config=AccountAuthConfig;
  const enabled=config.enabled===true;
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const sessionKey="workbench-auth:"+config.url;
  let session=null, identity=null, refreshTask=null, notify=()=>{}, namespace="", checking=false;
  function readSession(){try{return JSON.parse(sessionStorage.getItem(sessionKey)??"null");}catch{return null;}}
  function store(value){session=value;try{value?sessionStorage.setItem(sessionKey,JSON.stringify(value)):sessionStorage.removeItem(sessionKey);}catch{}}
  function accept(value){store({access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at??Math.floor(Date.now()/1000)+value.expires_in});}
  async function raw(path,method="GET",body,token) {
    const r=await nativeFetch(config.url+path,{method,cache:"no-store",headers:{apikey:config.publicKey,
      ...(token?{Authorization:"Bearer "+token}:{}),"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const error=new Error(r.status===429?"操作过于频繁，请稍后重试。":data.error_description??data.error??data.message??"账号服务暂时不可用。");error.status=r.status;throw error;}
    return data;
  }
  async function token(){
    if(!session?.access_token)throw new Error("请先登录。");
    if(session.expires_at*1000>Date.now()+30000)return session.access_token;
    if(!refreshTask)refreshTask=raw("/auth/v1/token?grant_type=refresh_token","POST",{refresh_token:session.refresh_token})
      .then(value=>{accept(value);return value.access_token}).finally(()=>{refreshTask=null});
    return refreshTask;
  }
  async function profile(){
    const access=await token();
    const user=await raw("/auth/v1/user","GET",undefined,access);
    const rows=await raw("/rest/v1/workbench_profiles?id=eq."+encodeURIComponent(user.id)+"&select=id,display_name,employee_id,role,active,must_change_password","GET",undefined,access);
    if(!rows[0]?.active)throw Object.assign(new Error("账号未启用，请联系管理员。"),{status:403});
    identity=rows[0];return identity;
  }
  function storageKey(){
    if(!enabled)return "process-studio-offline-v1";
    if(!identity || identity.must_change_password)throw new Error("请先完成账号登录和密码修改。");
    return "process-studio-offline-v1:account:"+new URL(config.url).host+":"+identity.id;
  }
  function bindWorkspace(){
    const next=storageKey();if(namespace===next)return;
    if(mwe)mwe.then(db=>db.close()).catch(()=>{});
    mwe=null;SC={revision:0,state:_x()};Eu=_x();TN=false;
    XG("opening","正在打开当前账号的本机工作空间…");namespace=next;
  }
  function decorate(profile){return enabled&&identity?{...profile,name:identity.display_name,employeeId:identity.employee_id}:profile;}
  function assertWorkspace(expected){
    if(!enabled)return;
    if(!session || session.expires_at*1000<=Date.now() || !identity || identity.must_change_password || expected&&expected!==storageKey())throw new Error("登录状态已变化，请重新登录后继续。");
  }
  async function account(action,body={}){return raw("/functions/v1/workbench-accounts","POST",{action,...body},await token());}
  async function flush(){await Ei();await T$;}
  async function exportLegacy(){
    if(identity?.role!=="admin"||identity.must_change_password)throw new Error("仅管理员可迁移旧版数据。");
    const state=await new Promise((resolve,reject)=>{
      const request=indexedDB.open("process-studio-offline-v1");
      // Abort creation if this browser has no pre-login database. Nothing is
      // written to the legacy store or to the current account's workspace.
      request.onupgradeneeded=()=>request.transaction.abort();
      request.onerror=()=>reject(new Error("当前浏览器未发现旧版本机数据。"));
      request.onsuccess=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains("state")){db.close();reject(new Error("旧版数据格式不受支持。"));return;}
        const transaction=db.transaction("state","readonly"),get=transaction.objectStore("state").get("workspace");
        let workspace;
        get.onsuccess=()=>{workspace=get.result;};
        transaction.oncomplete=()=>{db.close();workspace?.state?resolve(workspace.state):reject(new Error("当前浏览器未发现旧版本机数据。"));};
        transaction.onerror=()=>{db.close();reject(new Error("无法读取旧版本机数据，请保留当前浏览器数据后重试。"));};
      };
    });
    N$({format:"process-studio-offline",version:1,exportedAt:new Date().toISOString(),state},"工程师工作台_旧版本机备份.json");
  }
  async function leave(){
    await flush();
    const old=session?.access_token;
    if(old)await raw("/auth/v1/logout?scope=local","POST",{},old).catch(()=>{});
    store(null);identity=null;notify(null);
  }
  function Field({label,type="text",value,onChange,autoComplete,required=true,disabled=false}){
    return h("label",{className:"form-label"},label,h("input",{"aria-label":label,type,value,onChange:e=>onChange(e.target.value),autoComplete,required,disabled,maxLength:type==="password"?128:40}));
  }
  function Password({required=false,onDone}){
    const [old,setOld]=R.useState(""),[next,setNext]=R.useState(""),[repeat,setRepeat]=R.useState(""),[busy,setBusy]=R.useState(false),[error,setError]=R.useState("");
    async function submit(e){e.preventDefault();setBusy(true);setError("");try{
      if(next.length<12||!/[A-Za-z]/.test(next)||!/[0-9]/.test(next))throw new Error("新密码至少12位，并包含字母和数字。");
      if(next!==repeat)throw new Error("两次输入的新密码不一致。");
      await account("change-password",{currentPassword:old,newPassword:next});
      // Password updates may revoke the previous Supabase session. Establish
      // the new session before reading the profile or opening local data.
      accept(await raw("/auth/v1/token?grant_type=password","POST",{email:identity.employee_id+"@workbench.invalid",password:next}));
      await profile();bindWorkspace();notify({...identity});onDone?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}}
    return h("form",{onSubmit:submit,className:"account-form"},
      h("h2",null,required?"首次登录，请修改密码":"修改登录密码"),
      h("p",{className:"muted"},"账号："+identity.employee_id+" · "+identity.display_name),
      h(Field,{label:"原密码",type:"password",value:old,onChange:setOld,autoComplete:"current-password"}),
      h(Field,{label:"新密码",type:"password",value:next,onChange:setNext,autoComplete:"new-password"}),
      h(Field,{label:"确认新密码",type:"password",value:repeat,onChange:setRepeat,autoComplete:"new-password"}),
      h("p",{className:"small muted"},"至少12位，包含字母和数字。"),error&&h("p",{role:"alert",className:"error-banner"},error),
      h("div",{className:"button-row"},!required&&h("button",{type:"button",className:"button",disabled:busy,onClick:onDone},"取消"),h("button",{className:"button primary",disabled:busy},busy?"正在保存…":"保存新密码")));
  }
  function Login(){
    const [id,setId]=R.useState(""),[password,setPassword]=R.useState(""),[busy,setBusy]=R.useState(false),[error,setError]=R.useState("");
    async function login(e){e.preventDefault();setBusy(true);setError("");try{
      const employee=id.normalize("NFKC").trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(employee))throw new Error("请输入管理员发放的工号。");
      const value=await raw("/auth/v1/token?grant_type=password","POST",{email:employee+"@workbench.invalid",password});accept(value);
      const own=await profile();if(!own.must_change_password)bindWorkspace();notify({...own});
    }catch(e){store(null);identity=null;setError(e.status===400?"工号或密码不正确，或账号尚未启用。":e.message);}finally{setBusy(false);}}
    return h("form",{className:"account-form",onSubmit:login},h("span",{className:"account-brand"},"工程师工作台"),h("h1",null,"登录你的工作台"),
      h("p",{className:"muted"},"请使用管理员发放的工号和密码。"),
      h(Field,{label:"登录工号",value:id,onChange:setId,autoComplete:"username"}),h(Field,{label:"登录密码",type:"password",value:password,onChange:setPassword,autoComplete:"current-password"}),
      error&&h("p",{className:"error-banner",role:"alert"},error),h("button",{className:"button primary",disabled:busy},busy?"正在登录…":"登录"),
      h("p",{className:"small muted"},"没有账号或忘记密码，请联系管理员。"));
  }
  function Admin(){
    const [rows,setRows]=R.useState([]),[name,setName]=R.useState(""),[id,setId]=R.useState(""),[busy,setBusy]=R.useState(false),[error,setError]=R.useState(""),[issued,setIssued]=R.useState(null);
    const reload=async()=>setRows((await account("list")).accounts);
    R.useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
    async function run(action,body){setBusy(true);setError("");setIssued(null);try{
      const result=await account(action,body);if(result.temporaryPassword)setIssued(result);await reload();
      if(action==="create"){setName("");setId("");}
    }catch(e){setError(e.message);}finally{setBusy(false);}}
    const accountRows=rows.map(row=>{
      const actions=row.id===identity.id?null:h("div",{className:"button-row"},
        h("button",{className:"button small-button",disabled:busy,onClick:()=>{
          if(window.confirm("重置“"+row.display_name+"”的密码？使用者需用新初始密码重新改密。"))run("reset-password",{id:row.id});
        }},"重置密码"),
        h("button",{className:"button small-button",disabled:busy,onClick:()=>{
          if(window.confirm((row.active?"停用":"启用")+"账号“"+row.display_name+"”？"))run("set-active",{id:row.id,active:!row.active});
        }},row.active?"停用":"启用"));
      return h("tr",{key:row.id},
        h("td",null,row.display_name,h("small",null,"　"+row.employee_id+(row.role==="admin"?" · 管理员":""))),
        h("td",null,!row.active?"已停用":row.must_change_password?"待修改密码":"正常"),h("td",null,actions));
    });
    return h("div",{className:"account-admin"},h("h2",null,"账号管理"),h("p",{className:"muted"},"由你创建账号、绑定姓名和工号，并发放初始密码。"),
      h("section",{className:"account-issued"},h("b",null,"迁移启用登录前的数据"),h("p",{className:"small"},"旧版数据仍保留在原浏览器。导出备份后，可用工作台顶部“恢复备份”迁入当前账号。"),h("button",{className:"button small-button",disabled:busy,onClick:()=>exportLegacy().catch(e=>setError(e.message))},"导出旧版本机备份")),
      h("form",{className:"account-create",onSubmit:e=>{e.preventDefault();run("create",{name,employeeId:id});}},
        h(Field,{label:"新账号姓名",value:name,onChange:setName,autoComplete:"off"}),h(Field,{label:"新账号工号",value:id,onChange:setId,autoComplete:"off"}),
        h("button",{className:"button primary",disabled:busy},"创建并生成初始密码")),
      error&&h("p",{className:"error-banner",role:"alert"},error),issued&&h("section",{className:"account-issued",role:"status"},
        h("b",null,"请将以下信息单独发给使用者"),h("p",null,"姓名："+issued.name+"　工号："+issued.employeeId),h("p",null,"初始密码：",h("code",null,issued.temporaryPassword)),
        h("p",{className:"small"},"密码仅在本次操作后显示，首次登录必须修改。关闭此窗口后不再显示。")),
      h("div",{className:"table-wrap"},h("table",{className:"data-table"},h("thead",null,h("tr",null,...["姓名 / 工号","状态","操作"].map(s=>h("th",{key:s},s)))),
        h("tbody",null,...accountRows))));
  }
  function Controls(){
    const own=R.useContext(Context),[modal,setModal]=R.useState(""),[error,setError]=R.useState("");
    if(!enabled||!own)return null;
    return h(R.Fragment,null,own.role==="admin"&&h("button",{onClick:()=>setModal("admin")},"账号管理"),
      h("button",{onClick:()=>setModal("password")},"修改密码"),h("button",{onClick:()=>leave().catch(e=>setError(e.message))},"退出登录"),
      error&&h("span",{role:"alert"},error),modal&&h("div",{className:"account-overlay",role:"dialog","aria-modal":true,"aria-label":modal==="admin"?"账号管理":"修改密码"},
        h("section",{className:"account-dialog"},h("button",{className:"account-close button","aria-label":"关闭账号窗口",onClick:()=>setModal("")},"关闭"),modal==="admin"?h(Admin):h(Password,{onDone:()=>setModal("")}))));
  }
  function Gate({children}){
    const [own,setOwn]=R.useState(null),[loading,setLoading]=R.useState(enabled),[error,setError]=R.useState("");
    R.useEffect(()=>{
      if(!enabled)return;
      if(location.protocol==="file:"){setLoading(false);return;}
      let live=true;notify=value=>{if(live){setOwn(value);setLoading(false);setError("");}};
      async function check(initial=false){
        if(checking)return;checking=true;
        try{if(initial)session=readSession();if(session){const data=await profile();if(!data.must_change_password)bindWorkspace();notify({...data});}}
        catch(e){await flush().catch(()=>{});store(null);identity=null;if(live){setOwn(null);setError(e.status?e.message:"无法连接账号服务，请检查网络后重试登录。");}}
        finally{checking=false;if(live)setLoading(false);}
      }
      check(true);const timer=setInterval(()=>{if(!document.hidden)check();},60000);
      const visible=()=>{if(!document.hidden)check();};document.addEventListener("visibilitychange",visible);
      return()=>{live=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
    },[]);
    if(!enabled)return children;
    if(location.protocol==="file:")return h("main",{className:"account-login"},h("section",{className:"account-form"},h("h2",null,"请通过网站或本机启动器登录"),h("p",null,"账号版需要联网验证身份。请打开工作台网址，或使用 Windows 便携启动器。"),h("a",{className:"button primary",href:"https://seantim-could.github.io/Process-engineer/"},"打开工作台网站")));
    if(loading)return h("main",{className:"account-login"},h("section",{className:"account-form",role:"status"},"正在验证登录…"));
    if(!own)return h("main",{className:"account-login"},h("section",null,error&&h("p",{role:"alert",className:"error-banner"},error),h(Login)));
    if(own.must_change_password)return h("main",{className:"account-login"},h("section",null,h(Password,{required:true}),h("button",{className:"button",onClick:()=>leave().catch(e=>setError(e.message))},"退出登录")));
    return h(Context.Provider,{value:own},h(R.Fragment,{key:own.id},children));
  }
  return {Gate,Controls,enabled,storageKey,decorate,assertWorkspace};
})();
