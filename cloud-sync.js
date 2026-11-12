(function(root,factory){let storage=null;try{storage=root.localStorage}catch{}const api=factory(root.fetch?.bind(root),storage);if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishAICloud=api})(typeof globalThis!=='undefined'?globalThis:this,function(fetcher,storage){
  const CONFIG_KEY='englishai-cloud-config',SESSION_KEY='englishai-cloud-session',BUCKET='englishai-media';
  let config=null,session=null,refreshing=null;
  try{config=JSON.parse(storage?.getItem(CONFIG_KEY)||'null');session=JSON.parse(storage?.getItem(SESSION_KEY)||'null')}catch{}
  const configured=()=>!!(config?.url&&config?.key);
  const loggedIn=()=>!!(configured()&&session?.refresh_token&&session?.user?.id);
  const email=()=>session?.user?.email||'';
  function configure(url,key){
    const parsed=new URL(url.trim());
    if(parsed.protocol!=='https:'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(parsed.origin))throw Error('请输入 Supabase 项目的 HTTPS 地址。');
    if(!key.trim())throw Error('请输入 Supabase publishable key。');
    config={url:parsed.origin,key:key.trim()};session=null;
    storage?.setItem(CONFIG_KEY,JSON.stringify(config));storage?.removeItem(SESSION_KEY);
  }
  const getConfig=()=>config&&{...config};
  function saveSession(data){session=data;storage?.setItem(SESSION_KEY,JSON.stringify(data))}
  function logout(){session=null;storage?.removeItem(SESSION_KEY)}
  async function request(path,options={},authenticated=false,retry=true){
    if(!configured())throw Error('请先设置云端项目。');
    if(authenticated)await validSession();
    const headers={apikey:config.key,...options.headers};
    if(authenticated)headers.Authorization='Bearer '+session.access_token;
    const response=await fetcher(config.url+path,{...options,headers,cache:'no-store'});
    if(response.status===401&&authenticated&&retry){await refresh();return request(path,options,true,false)}
    if(!response.ok){let detail='';try{const body=await response.json();detail=body.message||body.msg||body.error_description||body.error||''}catch{}throw Error(detail||'云端请求失败（'+response.status+'）')}
    return response;
  }
  async function signup(address,password){
    const response=await request('/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,password})});
    const data=await response.json();if(data.access_token)saveSession(data);return !!data.access_token;
  }
  async function login(address,password){
    const response=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:address,password})});
    const data=await response.json();saveSession(data);return data.user;
  }
  async function refresh(){
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      if(!session?.refresh_token)throw Error('请先登录云端账号。');
      try{
        const response=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
        saveSession(await response.json());return session;
      }catch(error){logout();throw Error('云端登录已失效，请重新登录。')}
    })();
    try{return await refreshing}finally{refreshing=null}
  }
  async function validSession(){
    if(!loggedIn())throw Error('请先登录云端账号。');
    if(Date.now()/1000>(session.expires_at||0)-60)await refresh();
  }
  const objectPath=(id,extension)=>session.user.id+'/'+id+extension;
  const encodedPath=path=>path.split('/').map(encodeURIComponent).join('/');
  const objectUrl=path=>'/storage/v1/object/'+BUCKET+'/'+encodedPath(path);
  async function upload(path,blob,type){
    return request(objectUrl(path),{method:'POST',headers:{'Content-Type':type||'application/octet-stream','x-upsert':'true'},body:blob},true);
  }
  async function download(path){return request('/storage/v1/object/authenticated/'+BUCKET+'/'+encodedPath(path),{},true)}
  async function list(){
    const response=await request('/storage/v1/object/list/'+BUCKET,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:session.user.id+'/',limit:1000,offset:0})},true);
    return response.json();
  }
  const metadata=video=>({id:video.id,name:video.name,type:video.type,size:video.size,savedAt:video.savedAt,updatedAt:video.updatedAt||video.savedAt,subtitleText:video.subtitleText||'',subtitleName:video.subtitleName||''});
  async function sync(mediaStore,onProgress=()=>{}){
    await validSession();
    const entries=await list(),remote=new Map();
    for(const entry of entries){
      if(!entry.name?.endsWith('.json'))continue;
      try{const response=await download(session.user.id+'/'+entry.name);const item=await response.json();if(item.id?.startsWith('video:'))remote.set(item.id,item)}catch{}
    }
    let uploaded=0,downloaded=0,updated=0,skipped=0;
    const locals=await mediaStore.listVideos();
    for(const video of locals){
      if(video.id==='video')continue;
      const cloud=remote.get(video.id);
      if(!cloud){
        if(video.size>50*1024*1024){skipped++;continue}
        onProgress('正在上传：'+video.name);
        await upload(objectPath(video.id,''),video.blob,video.type);
        await upload(objectPath(video.id,'.json'),new Blob([JSON.stringify(metadata(video))],{type:'application/json'}),'application/json');
        uploaded++;
      }else if((video.updatedAt||video.savedAt||'')>(cloud.updatedAt||cloud.savedAt||'')){
        onProgress('正在同步字幕：'+video.name);
        await upload(objectPath(video.id,'.json'),new Blob([JSON.stringify(metadata(video))],{type:'application/json'}),'application/json');updated++;
      }else if((cloud.updatedAt||cloud.savedAt||'')>(video.updatedAt||video.savedAt||'')){
        await mediaStore.updateVideoMetadata(video.id,cloud);updated++;
      }
      remote.delete(video.id);
    }
    for(const item of remote.values()){
      onProgress('正在下载：'+item.name);
      const response=await download(objectPath(item.id,''));
      const blob=await response.blob();
      await mediaStore.importVideo({...item,blob});downloaded++;
    }
    return{uploaded,downloaded,updated,skipped};
  }
  async function deleteRemote(id){
    await validSession();
    const paths=[objectPath(id,''),objectPath(id,'.json')];
    await request('/storage/v1/object/'+BUCKET,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})},true);
  }
  return{configured,loggedIn,email,configure,getConfig,signup,login,logout,sync,deleteRemote};
});
