// The offline edition has one local workspace and no account service or login UI.
var AccountAuth = (() => {
  const storageKey=()=>"process-studio-offline-v1";
  return {
    enabled:false,
    Gate:({children})=>children,
    Controls:()=>null,
    storageKey,
    decorate:profile=>profile,
    assertWorkspace:()=>{},
    resumeWorkspace:async()=>true,
    isAdmin:()=>false
  };
})();
