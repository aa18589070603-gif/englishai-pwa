const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('stores and restores the latest video and subtitles on the current device',async()=>{
  const records=new Map();
  const db={createObjectStore(){},close(){},transaction(){
    let pending=0;
    const operation=(method,value)=>{
      const request={};pending++;
      queueMicrotask(()=>{
        if(method==='put'){records.set(value.id,value);request.result=value.id}
        if(method==='get')request.result=records.get(value);
        if(method==='getAll')request.result=[...records.values()];
        if(method==='delete')records.delete(value);
        if(method==='clear')records.clear();
        request.onsuccess?.();pending--;
        if(!pending)queueMicrotask(()=>tx.oncomplete?.());
      });return request;
    };
    const tx={objectStore(){return Object.fromEntries(['get','put','getAll','delete','clear'].map(method=>[method,value=>operation(method,value)]))}};return tx;
  }};
  const indexedDB={open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.()});return request}};
  const context={indexedDB,Promise,Error,URL,Blob};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../media-store.js'),'utf8'),context);
  const media=context.EnglishAIMedia;
  records.set('video',{id:'video',blob:{name:'old.mp4'},name:'old.mp4',size:10});
  records.set('subtitles',{id:'subtitles',text:'Old',name:'old.srt'});
  assert.equal((await media.getActiveVideo()).name,'old.mp4');
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Old');
  const video={name:'clip.mp4',type:'video/mp4',size:42};
  const latest=await media.saveVideo(video);
  await media.saveSubtitles('Hello\n你好','sample.srt');
  await media.savePosition(latest.id,2);
  assert.equal(await media.getPosition(latest.id),2);
  assert.equal((await media.getActiveVideo()).blob,video);
  assert.equal((await media.listVideos()).length,2);
  assert.equal((await media.getActiveVideo()).name,'clip.mp4');
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Hello\n你好');
  const second=await media.saveVideo({name:'second.mp4',type:'video/mp4',size:30});
  await media.saveSubtitles('Second','second.srt');
  await media.savePosition(second.id,1);
  assert.equal(await media.getPosition(second.id),1);
  assert.equal((await media.listVideos()).length,3);
  await media.activateVideo(latest.id);
  assert.equal(await media.getPosition(latest.id),2);
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Hello\n你好');
  await media.activateVideo(second.id);
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Second');
  await media.activateVideo('video');
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Old');
  await media.activateVideo(latest.id);
  await media.clearSubtitles();
  assert.equal(await media.getSubtitlesFor(await media.getActiveVideo()),null);
  await media.deleteVideo(latest.id);
  assert.equal(await media.getPosition(latest.id),0);
  assert.equal((await media.getActiveVideo()).name,'second.mp4');
  assert.throws(()=>media.saveRemoteVideo('http://example.com/video.mp4'),/HTTPS/);
  const online=await media.saveRemoteVideo('https://example.com/lesson.mp4?edition=1#preview');
  assert.equal(online.url,'https://example.com/lesson.mp4?edition=1');
  assert.equal((await media.getActiveVideo()).id,online.id);
  await media.saveSubtitles('Online caption','online.srt');
  assert.equal((await media.getSubtitlesFor(await media.getActiveVideo())).text,'Online caption');
  const downloaded=await media.saveDownloadedVideo(online.id,new Blob(['video'],{type:'video/mp4'}));
  assert.equal(downloaded.blob.size,5);
  assert.equal(downloaded.subtitleText,'Online caption');
  await media.activateVideo(second.id);
  await media.activateVideo(online.id);
  assert.equal((await media.getActiveVideo()).url,online.url);
  await media.clearMedia();
  assert.equal((await media.listVideos()).length,0);
});

