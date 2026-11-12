(function(root,factory){const api=factory(root.indexedDB);if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishAIMedia=api})(typeof globalThis!=='undefined'?globalThis:this,function(indexedDB){
  function open(){
    if(!indexedDB)return Promise.reject(Error('当前浏览器不支持本机素材保存。'));
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('englishai-v2-media',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('无法打开本机存储。'));
    });
  }
  async function run(mode,action){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let value,failure;
      try{
        const tx=db.transaction('media',mode),request=action(tx.objectStore('media'));
        request.onsuccess=()=>{value=request.result};
        request.onerror=()=>{failure=request.error};
        tx.oncomplete=()=>{db.close();resolve(value)};
        tx.onerror=()=>{db.close();reject(failure||tx.error||Error('素材保存失败。'))};
        tx.onabort=()=>{db.close();reject(failure||tx.error||Error('素材保存被中断。'))};
      }catch(error){db.close();reject(error)}
    });
  }
  const get=id=>run('readonly',store=>store.get(id));
  const remove=id=>run('readwrite',store=>store.delete(id));
  async function listVideos(){
    const all=await run('readonly',store=>store.getAll());
    return all.filter(item=>item.id==='video'||item.id.startsWith('video:')).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''));
  }
  async function getActiveVideo(){
    const active=await get('active-video');
    return active?.videoId&&await get(active.videoId)||await get('video')||(await listVideos())[0]||null;
  }
  async function activateVideo(id){
    const video=await get(id);if(!video||!video.blob)throw Error('找不到这个已保存的视频。');
    await run('readwrite',store=>store.put({id:'active-video',videoId:id}));
    return video;
  }
  function saveVideo(file){
    const id='video:'+Date.now()+':'+Math.random().toString(36).slice(2);
    const record={id,blob:file,name:file.name||'视频',type:file.type||'',size:file.size||0,savedAt:new Date().toISOString(),subtitleText:'',subtitleName:''};
    return run('readwrite',store=>{const request=store.put(record);store.put({id:'active-video',videoId:id});return request}).then(()=>record);
  }
  async function importVideo(record){
    if(!record?.id?.startsWith('video:')||!record.blob)throw Error('无效的云端视频。');
    if(await get(record.id))return false;
    await run('readwrite',store=>store.put(record));
    return true;
  }
  async function updateVideoMetadata(id,metadata){
    const video=await get(id);
    if(!video?.blob)throw Error('本机找不到这个视频。');
    await run('readwrite',store=>store.put({...video,subtitleText:metadata.subtitleText||'',subtitleName:metadata.subtitleName||'',updatedAt:metadata.updatedAt||video.savedAt}));
  }
  async function getSubtitlesFor(video){
    if(video?.subtitleText)return{text:video.subtitleText,name:video.subtitleName||'已保存字幕'};
    if(video&&(video.id!=='video'||Object.hasOwn(video,'subtitleText')))return null;
    return await get('subtitles')||null;
  }
  async function saveSubtitles(text,name){
    const video=await getActiveVideo();
    if(video)return run('readwrite',store=>store.put({...video,subtitleText:String(text),subtitleName:name||'字幕',updatedAt:new Date().toISOString()}));
    return run('readwrite',store=>store.put({id:'subtitles',text:String(text),name:name||'字幕'}));
  }
  async function clearSubtitles(){
    const video=await getActiveVideo();
    if(video)return run('readwrite',store=>store.put({...video,subtitleText:'',subtitleName:'',updatedAt:new Date().toISOString()}));
    return remove('subtitles');
  }
  async function deleteVideo(id){
    await remove(id);
    const active=await get('active-video');
    if(active?.videoId===id){const next=(await listVideos())[0];if(next)await activateVideo(next.id);else await remove('active-video')}
  }
  const clearMedia=()=>run('readwrite',store=>store.clear());
  return{get,remove,listVideos,getActiveVideo,activateVideo,saveVideo,importVideo,updateVideoMetadata,getSubtitlesFor,saveSubtitles,clearSubtitles,deleteVideo,clearMedia};
});
