const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseSubtitles,compareText,clozeFor,quizFor}=require('../core.js');

test('parses and sorts bilingual SRT and VTT cues',()=>{
  const srt='2\n00:00:04,000 --> 00:00:06,000\nSecond line.\n第二句\n\n1\n00:00:01,000 --> 00:00:03,000\nFirst line.\n第一句';
  assert.deepEqual(parseSubtitles(srt).map(c=>c.en),['First line.','Second line.']);
  const vtt='WEBVTT\n\n00:00:01.000 --> 00:00:02.500 align:start\n<b>Hello!</b>\n你好';
  assert.deepEqual(parseSubtitles(vtt),[{start:1,end:2.5,en:'Hello!',zh:'你好'}]);
  assert.equal(parseSubtitles('00:00:03.000 --> 00:00:02.000\nInvalid').length,0);
});

test('reports literal word differences without scoring pronunciation',()=>{
  assert.equal(compareText('Hello, how are you?','hello how are you').exact,true);
  assert.deepEqual(compareText('I am learning English','I learning French'),{exact:false,missing:['am','english'],extra:['french']});
});

test('generates cloze and quiz only from available subtitle text',()=>{
  const cues=[{en:'Practice makes progress.',zh:'练习带来进步。'},{en:'Try again.',zh:'再试一次。'},{en:'Keep going.',zh:'继续加油。'}];
  assert.deepEqual(clozeFor(cues[0]),{prompt:'____ makes progress.',answer:'Practice'});
  const quiz=quizFor(cues,0);
  assert.equal(quiz.question,cues[0].en);
  assert.equal(quiz.options.length,3);
  assert.ok(quiz.options.includes(quiz.answer));
  assert.equal(quizFor(cues.slice(0,2),0),null);
});

test('page contains every element referenced by the application',()=>{
  const root=path.join(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8')+fs.readFileSync(path.join(root,'dialogue.js'),'utf8');
  const ids=[...app.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]);
  for(const id of new Set(ids))assert.ok(html.includes('id="'+id+'"'),'missing #'+id);
  for(const asset of ['core.js','vocab.js','media-store.js','app.js','dialogue.js','styles.css'])assert.ok(html.includes(asset));
});
