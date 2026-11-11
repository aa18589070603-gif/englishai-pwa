const test=require('node:test');
const assert=require('node:assert/strict');

test('AI dialogue endpoint keeps the key server-side and validates input',async()=>{
  const {default:dialogue,config}=await import('../netlify/functions/dialogue.mjs');
  assert.equal(config.path,'/api/dialogue');
  const oldKey=process.env.OPENAI_API_KEY,oldFetch=global.fetch;
  try{
    delete process.env.OPENAI_API_KEY;
    const unavailable=await dialogue(new Request('https://example.netlify.app/api/dialogue'));
    assert.equal((await unavailable.json()).ready,false);
    process.env.OPENAI_API_KEY='test-secret';
    const invalid=await dialogue(new Request('https://example.netlify.app/api/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:'daily',messages:[{role:'user',content:'x'.repeat(501)}]})}));
    assert.equal(invalid.status,400);
    let upstream;
    global.fetch=async(url,options)=>{
      upstream={url,options};
      return Response.json({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Hello! How was your day?'}]}]});
    };
    const response=await dialogue(new Request('https://example.netlify.app/api/dialogue',{method:'POST',headers:{'content-type':'application/json','origin':'https://example.netlify.app'},body:JSON.stringify({topic:'daily',messages:[{role:'user',content:'Hello!'}]})}));
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{reply:'Hello! How was your day?'});
    assert.equal(upstream.url,'https://api.openai.com/v1/responses');
    assert.equal(upstream.options.headers.authorization,'Bearer test-secret');
    assert.equal(JSON.parse(upstream.options.body).store,false);
    assert.equal(JSON.parse(upstream.options.body).max_output_tokens,220);
    const blocked=await dialogue(new Request('https://example.netlify.app/api/dialogue',{method:'POST',headers:{'content-type':'application/json','origin':'https://other.example'},body:'{}'}));
    assert.equal(blocked.status,403);
  }finally{
    if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;
    global.fetch=oldFetch;
  }
});
