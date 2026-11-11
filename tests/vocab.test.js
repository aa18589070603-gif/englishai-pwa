const test=require('node:test');
const assert=require('node:assert/strict');
const vocab=require('../vocab.js');

test('normalizes tapped words and supplies offline sample meanings',()=>{
  assert.equal(vocab.normalizeWord('Progress!'),'progress');
  assert.equal(vocab.localDefinition('Progress!').translation,'进步');
  assert.equal(vocab.localDefinition('unlistedword'),null);
});

test('extracts concise dictionary and translation responses',()=>{
  const entry=vocab.parseDictionary([{phonetic:'/test/',meanings:[{partOfSpeech:'noun',definitions:[{definition:'a procedure',example:'one test'}]}]}]);
  assert.deepEqual(entry,{phonetic:'/test/',partOfSpeech:'noun',definition:'a procedure',example:'one test'});
  assert.equal(vocab.parseTranslation({responseData:{translatedText:'测试'}}),'测试');
});

test('saves one copy of each word with the latest note',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  let items=vocab.upsertWord([],{word:'Practice',note:''});
  items=vocab.upsertWord(items,{word:'practice',note:'每天练习'});
  assert.equal(items.length,1);
  assert.equal(vocab.writeWordbook(storage,items),true);
  assert.equal(vocab.readWordbook(storage)[0].note,'每天练习');
});
