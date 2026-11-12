const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');
const vocab=require('../vocab.js');

test('sample subtitles support speech and tapped words can be saved with notes',async()=>{
  const elements=new Map();
  function element(){
    const classes=new Set();
    return{textContent:'',value:'',src:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:x=>classes.has(x)?classes.delete(x):classes.add(x),contains:x=>classes.has(x)},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},setAttribute(){},addEventListener(){},focus(){},play(){throw Error('video should not play')},querySelectorAll(){return[]}};
  }
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  let spoken=null;
  class Utterance{constructor(text){this.text=text}}
  const synth={getVoices:()=>[],speak:utterance=>{spoken=utterance},cancel(){}};
  const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const mediaData=new Map();let activeVideo=null;
  const mediaStore={
    listVideos:async()=>[...mediaData.values()].filter(item=>item.id?.startsWith('video:')),
    getActiveVideo:async()=>activeVideo&&mediaData.get(activeVideo)||null,
    getSubtitlesFor:async video=>video?.subtitleText?{text:video.subtitleText,name:video.subtitleName}:null,
    saveVideo:async file=>{const item={id:'video:1',blob:file,name:file.name,size:file.size,subtitleText:''};mediaData.set(item.id,item);activeVideo=item.id;return item},
    saveSubtitles:async(text,name)=>{const item=mediaData.get(activeVideo);item.subtitleText=text;item.subtitleName=name},
    activateVideo:async id=>{activeVideo=id;return mediaData.get(id)},
    clearSubtitles:async()=>{},deleteVideo:async()=>{},clearMedia:async()=>mediaData.clear()
  };
  const context={
    EnglishAICore:core,
    EnglishAIVocab:vocab,
    EnglishAIMedia:mediaStore,
    document:{getElementById:get,querySelector:()=>element(),querySelectorAll:()=>[],createElement:element,createTextNode:text=>({textContent:text}),addEventListener(){}},
    window:{isSecureContext:true,SpeechSynthesisUtterance:Utterance,speechSynthesis:synth,localStorage:storage},
    navigator:{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:1},
    location:{protocol:'http:'},
    setTimeout(){},
    URL:{createObjectURL:()=>''}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
  get('sample').onclick();
  get('play').onclick();
  assert.equal(spoken?.text,'Hello, how are you?');
  assert.equal(spoken?.lang,'en-US');
  assert.equal(spoken?.voice,undefined);
  assert.match(get('playStatus').textContent,/正在启动设备英文语音/);
  const firstLine=get('lines').children[0],english=firstLine.children[0];
  english.children.find(child=>child.textContent==='Hello').onclick({stopPropagation(){}});
  assert.equal(get('wordTitle').textContent,'Hello');
  assert.match(get('wordTranslation').textContent,/你好/);
  get('wordNote').value='打招呼时使用';
  get('saveNote').onclick();
  assert.equal(get('wordCount').textContent,1);
  assert.equal(JSON.parse(data.get(vocab.KEY))[0].note,'打招呼时使用');
  assert.equal(get('noteList').children[0].textContent,'hello：打招呼时使用');
  get('revealWord').onclick();
  assert.match(get('reviewAnswer').textContent,/打招呼时使用/);
  get('hearReviewWord').onclick();
  assert.equal(spoken?.text,'hello');
  assert.equal(spoken?.lang,'en-US');
  assert.match(get('reviewSpeechStatus').textContent,/正在启动英文发音/);
  get('rememberWord').onclick();
  assert.equal(get('dueCount').textContent,'0 个单词待复习');
  assert.match(get('reviewWord').textContent,/本轮复习完成/);
  get('reviewAll').onclick();
  assert.equal(get('reviewWord').textContent,'hello');
  const backup=JSON.stringify(vocab.makeBackup([{word:'progress',note:'进步'}]));
  await get('importWordbookFile').onchange({target:{files:[{size:backup.length,text:async()=>backup}],value:'backup.json'}});
  assert.equal(get('wordCount').textContent,2);
  assert.match(get('backupStatus').textContent,/已导入 1 个新单词/);
  await get('videoFile').onchange({target:{files:[{name:'clip.mp4',size:42,type:'video/mp4'}]}});
  assert.equal(mediaData.get('video:1').name,'clip.mp4');
  const srt='1\n00:00:01,000 --> 00:00:02,000\nHello!\n你好';
  await get('subtitleFile').onchange({target:{files:[{name:'captions.srt',text:async()=>srt}]}});
  assert.equal(mediaData.get('video:1').subtitleText,srt);
  assert.equal(get('savedVideoCount').textContent,1);
  await get('savedVideoList').children[0].children[1].onclick();
  assert.match(get('localSaveStatus').textContent,/已打开保存的视频/);
  assert.equal(get('cueCount').textContent,'1 句');
});
