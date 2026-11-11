const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');
const vocab=require('../vocab.js');

test('sample subtitles support speech and tapped words can be saved with notes',()=>{
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
  const context={
    EnglishAICore:core,
    EnglishAIVocab:vocab,
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
});
