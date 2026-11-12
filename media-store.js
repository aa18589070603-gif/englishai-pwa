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
  const saveVideo=file=>run('readwrite',store=>store.put({id:'video',blob:file,name:file.name||'视频',type:file.type||'',size:file.size||0}));
  const saveSubtitles=(text,name)=>run('readwrite',store=>store.put({id:'subtitles',text:String(text),name:name||'字幕'}));
  return{get,remove,saveVideo,saveSubtitles};
});
