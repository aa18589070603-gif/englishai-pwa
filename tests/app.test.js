const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');

test('sample subtitles play through device speech when no video is selected',()=>{
  const elements=new Map();
  function element(){
    return{textContent:'',value:'',src:'',classList:{add(){},remove(){},toggle(){}},replaceChildren(){},append(){},setAttribute(){},addEventListener(){},play(){throw Error('video should not play')},querySelectorAll(){return[]}};
  }
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  let spoken=null;
  class Utterance{constructor(text){this.text=text}}
  const synth={getVoices:()=>[],speak:utterance=>{spoken=utterance},cancel(){}};
  const context={
    EnglishAICore:core,
    document:{getElementById:get,querySelector:()=>element(),querySelectorAll:()=>[],createElement:element},
    window:{isSecureContext:true,SpeechSynthesisUtterance:Utterance,speechSynthesis:synth},
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
});
