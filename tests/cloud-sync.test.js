const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('a video and its subtitles upload on one device and download on another account session',async()=>{
  const objects=new Map();
  const fetcher=async(url,options={})=>{
    const route=new URL(url).pathname;
    if(route==='/auth/v1/token')return Response.json({access_token:'token',refresh_token:'refresh',expires_at:Date.now()/1000+3600,user:{id:'user-1',email:'test@example.com'}});
    if(route.endsWith('/object/list/englishai-media'))return Response.json([...objects.keys()].filter(key=>key.startsWith('user-1/')).map(key=>({name:key.slice('user-1/'.length)})));
    if(route.includes('/object/authenticated/englishai-media/')){
      const key=decodeURIComponent(route.split('/object/authenticated/englishai-media/')[1]);
      return new Response(objects.get(key)||'missing',{status:objects.has(key)?200:404});
    }
    if(route.includes('/object/englishai-media/')){
      const key=decodeURIComponent(route.split('/object/englishai-media/')[1]);
      objects.set(key,options.body);return new Response('ok');
    }
    throw Error(route);
  };
  const makeClient=()=>{
    const values=new Map();
    const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
    const context={fetch:fetcher,localStorage,URL,Blob,Date,Promise,Error,JSON};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cloud-sync.js'),'utf8'),context);
    const client=context.EnglishAICloud;
    client.configure('https://project.supabase.co','sb_publishable_test');
    return client;
  };
  const desktop=makeClient(),phone=makeClient();
  await desktop.login('test@example.com','password');
  await phone.login('test@example.com','password');
  const video={id:'video:123',blob:new Blob(['video'],{type:'video/mp4'}),name:'lesson.mp4',type:'video/mp4',size:5,savedAt:'2026-11-12T00:00:00.000Z',subtitleText:'Hello\n你好',subtitleName:'lesson.srt'};
  const desktopStore={listVideos:async()=>[video]};
  const phoneVideos=[];
  const phoneStore={listVideos:async()=>phoneVideos,importVideo:async item=>{phoneVideos.push(item);return true}};
  assert.equal((await desktop.sync(desktopStore)).uploaded,1);
  assert.equal((await phone.sync(phoneStore)).downloaded,1);
  assert.equal(phoneVideos[0].name,'lesson.mp4');
  assert.equal(phoneVideos[0].subtitleText,'Hello\n你好');
  assert.equal(await phoneVideos[0].blob.text(),'video');
});
