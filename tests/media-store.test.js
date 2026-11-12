const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('stores and restores the latest video and subtitles on the current device',async()=>{
  const records=new Map();
  const db={createObjectStore(){},close(){},transaction(){
    const tx={objectStore(){return Object.fromEntries(['get','put','delete'].map(method=>[method,value=>{
      const request={};queueMicrotask(()=>{
        if(method==='put'){records.set(value.id,value);request.result=value.id}
        if(method==='get')request.result=records.get(value);
        if(method==='delete')records.delete(value);
        request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());
      });return request;
    }]))}};return tx;
  }};
  const indexedDB={open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.()});return request}};
  const context={indexedDB,Promise,Error};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../media-store.js'),'utf8'),context);
  const media=context.EnglishAIMedia;
  const video={name:'clip.mp4',type:'video/mp4',size:42};
  await media.saveVideo(video);
  await media.saveSubtitles('Hello\n你好','sample.srt');
  assert.equal((await media.get('video')).name,'clip.mp4');
  assert.equal((await media.get('subtitles')).text,'Hello\n你好');
  await media.remove('video');
  assert.equal(await media.get('video'),undefined);
});
