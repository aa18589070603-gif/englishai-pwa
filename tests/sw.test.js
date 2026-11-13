const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('service worker fetches fresh pages before using offline cache',async()=>{
  const handlers={},updates=[];let network=true,cacheReads=0;
  const cached=new Response('old page');
  const context={
    self:{addEventListener:(name,handler)=>handlers[name]=handler},
    caches:{match:async()=>{cacheReads++;return cached},open:async()=>({put:async()=>{}})},
    fetch:async()=>{if(!network)throw Error('offline');return new Response('new page')},
    location:{origin:'https://english.example'},URL,Response
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
  async function page(){let result;handlers.fetch({request:{url:'https://english.example/',method:'GET',mode:'navigate'},respondWith:value=>result=value,waitUntil:value=>updates.push(value)});return(await result).text()}
  assert.equal(await page(),'new page');
  assert.equal(cacheReads,0);
  network=false;
  assert.equal(await page(),'old page');
  await Promise.all(updates);
});
