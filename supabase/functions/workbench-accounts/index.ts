// Self-contained: this file can also be pasted into the Supabase function editor.
// No passwords, service keys, request bodies or tokens are logged.
type AccountConfig = {url?:string;anonKey?:string;serviceKey?:string;allowedOrigins?:string};
export function createAccountHandler(config:AccountConfig, transport:typeof fetch = fetch) {
  const origins = new Set((config.allowedOrigins ?? "").split(",").map(s => s.trim()).filter(Boolean));
  const base = config.url?.replace(/\/$/, "");
  class Failure extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
  function json(data:unknown,status:number,origin:string) {
    return new Response(status===204?null:JSON.stringify(data),{status,headers:{
      "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
      "Access-Control-Allow-Origin":origin,"Vary":"Origin",
      "Access-Control-Allow-Headers":"authorization, apikey, content-type",
      "Access-Control-Allow-Methods":"POST, OPTIONS","X-Content-Type-Options":"nosniff"
    }});
  }
  async function remote(path:string,method="GET",body?:unknown,token=config.serviceKey,key=config.serviceKey) {
    const r=await transport(base+path,{method,headers:{apikey:key??"",Authorization:"Bearer "+token,
      "Content-Type":"application/json",Prefer:"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json().catch(()=>null);
    if(!r.ok)throw new Failure("账号服务操作失败，请核对输入或稍后重试。",r.status===429?429:400);
    return data;
  }
  function password(value:unknown) {
    if(typeof value!=="string" || value.length<12 || value.length>128 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
      throw new Failure("密码须为12至128个字符，并包含字母和数字。");
    return value;
  }
  function temporaryPassword() {
    const bytes=crypto.getRandomValues(new Uint8Array(18));
    return "Wb7!"+[...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");
  }
  const profileFields="id,display_name,employee_id,role,active,must_change_password,created_at";
  return async (request:Request)=>{
    const origin=request.headers.get("Origin")??"";
    if(!origins.has(origin))return new Response(JSON.stringify({error:"请求来源未配置。"}),{status:403,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
    if(request.method==="OPTIONS")return json({},204,origin);
    if(request.method!=="POST")return json({error:"仅支持POST请求。"},405,origin);
    try {
      if(!base || !config.serviceKey || !config.anonKey)throw new Failure("账号服务尚未配置完成。",503);
      const token=request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
      if(!token)throw new Failure("请先登录。",401);
      let user;
      try {user=await remote("/auth/v1/user","GET",undefined,token);}
      catch {throw new Failure("登录已失效，请重新登录。",401);}
      const profiles=await remote("/rest/v1/workbench_profiles?id=eq."+encodeURIComponent(user.id)+"&select="+profileFields);
      const actor=profiles?.[0];
      if(!actor?.active)throw new Failure("账号未启用，请联系管理员。",403);
      const text=await request.text();
      if(text.length>8192)throw new Failure("请求内容过长。",413);
      let body;try{body=JSON.parse(text);}catch{throw new Failure("请求格式无效。");}
      if(body.action==="change-password") {
        const next=password(body.newPassword);
        if(next===body.currentPassword)throw new Failure("新密码不能与原密码相同。");
        // Verify the current password; a stolen/old bearer token alone cannot change it.
        let confirmed;
        try {confirmed=await remote("/auth/v1/token?grant_type=password","POST",{email:user.email,password:body.currentPassword},config.anonKey,config.anonKey);}
        catch {throw new Failure("原密码不正确，或验证过于频繁。",403);}
        if(confirmed.user?.id!==user.id)throw new Failure("账号验证失败。",403);
        await remote("/auth/v1/admin/users/"+user.id,"PUT",{password:next});
        await remote("/rest/v1/workbench_profiles?id=eq."+user.id,"PATCH",{must_change_password:false});
        return json({ok:true},200,origin);
      }
      if(actor.role!=="admin" || actor.must_change_password)throw new Failure("此操作仅限已完成首次改密的管理员。",403);
      if(body.action==="list")return json({accounts:await remote("/rest/v1/workbench_profiles?select="+profileFields+"&order=created_at.desc")},200,origin);
      if(body.action==="create") {
        const employeeId=String(body.employeeId??"").normalize("NFKC").trim().toLowerCase();
        const name=String(body.name??"").trim();
        if(!/^[a-z0-9][a-z0-9_.-]{0,39}$/.test(employeeId) || !name || name.length>40)throw new Failure("姓名须为1至40字；工号须为1至40位字母、数字、点、下划线或短横线。");
        const existing=await remote("/rest/v1/workbench_profiles?employee_id=eq."+encodeURIComponent(employeeId)+"&select=id");
        if(existing.length)throw new Failure("工号已存在，请使用其他工号。");
        const initial=temporaryPassword();
        const created=await remote("/auth/v1/admin/users","POST",{email:employeeId+"@workbench.invalid",password:initial,email_confirm:true});
        const id=created.id??created.user?.id;
        if(!id)throw new Failure("创建账号失败。");
        try {await remote("/rest/v1/workbench_profiles","POST",{id,display_name:name,employee_id:employeeId,role:"staff",active:true,must_change_password:true});}
        catch (error) {
          try {await remote("/auth/v1/admin/users/"+id,"DELETE");}catch{}
          throw error;
        }
        return json({employeeId,name,temporaryPassword:initial},200,origin);
      }
      if(!/^[0-9a-f-]{36}$/i.test(String(body.id??"")))throw new Failure("账号编号无效。");
      if(body.id===actor.id)throw new Failure("请使用“修改密码”；不能停用或重置自己的管理员账号。");
      const target=(await remote("/rest/v1/workbench_profiles?id=eq."+body.id+"&select="+profileFields))?.[0];
      if(!target)throw new Failure("账号不存在。",404);
      if(body.action==="reset-password") {
        const initial=temporaryPassword();
        // Close the application gate before changing the credential. If Auth
        // fails, the user still cannot continue with a stale application session.
        await remote("/rest/v1/workbench_profiles?id=eq."+body.id,"PATCH",{must_change_password:true});
        await remote("/auth/v1/admin/users/"+body.id,"PUT",{password:initial});
        return json({employeeId:target.employee_id,name:target.display_name,temporaryPassword:initial},200,origin);
      }
      if(body.action==="set-active" && typeof body.active==="boolean") {
        await remote("/rest/v1/workbench_profiles?id=eq."+body.id,"PATCH",{active:body.active});
        await remote("/auth/v1/admin/users/"+body.id,"PUT",{ban_duration:body.active?"none":"876000h"});
        return json({ok:true},200,origin);
      }
      throw new Failure("操作无效。");
    }catch(error){return json({error:error instanceof Failure?error.message:"账号服务暂时不可用，请稍后重试。"},error instanceof Failure?error.status:500,origin);}
  };
}

if(typeof Deno!=="undefined")Deno.serve(createAccountHandler({
  url:Deno.env.get("SUPABASE_URL"),anonKey:Deno.env.get("SUPABASE_ANON_KEY"),
  serviceKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),allowedOrigins:Deno.env.get("WORKBENCH_ALLOWED_ORIGINS")
}));
