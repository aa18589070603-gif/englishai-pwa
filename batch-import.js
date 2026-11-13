(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishAIBatch=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function stem(name){return String(name).replace(/\.(mp3|mp4|mov|srt|vtt)$/i,'').replace(/[-_. ]EnglishAI[-_. ]bilingual$/i,'').toLocaleLowerCase()}
  function pairFiles(files){
    const media=[],subtitles=new Map();
    for(const file of files){
      if(/\.(mp3|mp4|mov)$/i.test(file.name))media.push(file);
      else if(/\.(srt|vtt)$/i.test(file.name))subtitles.set(stem(file.name),file);
    }
    return{pairs:media.map(file=>({media:file,subtitle:subtitles.get(stem(file.name))})).filter(pair=>pair.subtitle),unmatched:media.filter(file=>!subtitles.has(stem(file.name))).map(file=>file.name)};
  }
  return{pairFiles};
});

