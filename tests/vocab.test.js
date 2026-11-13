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

test('review choices schedule familiar words and keep difficult words in the queue',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z');
  let items=vocab.upsertWord([],{word:'hello',note:'问候'});
  items=vocab.rateReview(items,'hello',true,now);
  assert.equal(items[0].reviewStreak,1);
  assert.equal(vocab.dueWords(items,now).length,0);
  assert.equal(vocab.dueWords(items,now+86400000).length,1);
  items=vocab.upsertWord(items,{word:'hello',note:'新的笔记'});
  assert.equal(items[0].reviewStreak,1);
  items=vocab.rateReview(items,'hello',false,now+86400000);
  assert.equal(items[0].reviewStreak,0);
  assert.equal(vocab.dueWords(items,now+86400000).length,1);
});

test('wordbook backup restores notes and review progress without replacing current words',()=>{
  const saved=[{word:'hello',note:'旧笔记',reviewStreak:2,nextReviewAt:'2026-11-20T00:00:00.000Z'},{word:'progress',note:'进步'}];
  const restored=vocab.parseBackup(JSON.stringify(vocab.makeBackup(saved)));
  assert.equal(restored[0].reviewStreak,2);
  assert.equal(restored[1].note,'进步');
  const merged=vocab.mergeWordbooks([{word:'hello',note:'当前笔记'}],restored);
  assert.deepEqual(merged.map(item=>item.word),['hello','progress']);
  assert.equal(merged[0].note,'当前笔记');
  assert.throws(()=>vocab.parseBackup('{bad'),/JSON/);
  assert.throws(()=>vocab.parseBackup(JSON.stringify({words:saved})),/EnglishAI/);
});
