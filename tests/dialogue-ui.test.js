const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('AI dialogue UI only enables sending after backend reports ready',async()=>{
  const elements=new Map();
  function element(){
    const classes=new Set();
    return{children:[],textContent:'',value:'',disabled:false,classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},remove(){},scrollHeight:0,scrollTop:0};
  }
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  let sent;
  const fetch=async(url,options)=>{
    if(!options?.method)return{ok:true,json:async()=>({ready:true})};
    sent=JSON.parse(options.body);return{ok:true,json:async()=>({reply:'Hello! How are you today?'})};
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dialogue.js'),'utf8'),{
    document:{getElementById:get,createElement:element},window:{isSecureContext:true},fetch
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('dialogueBadge').textContent,'已连接');
  assert.equal(get('sendDialogue').disabled,false);
  get('dialogueTopic').value='daily';get('dialogueInput').value='Hello';
  await get('sendDialogue').onclick();
  assert.deepEqual(sent.messages,[{role:'user',content:'Hello'}]);
  assert.equal(get('hearDialogue').disabled,false);
  assert.equal(get('dialogueInput').value,'');
});
