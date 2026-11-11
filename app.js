const $=id=>document.getElementById(id);
const {parseSubtitles,compareText,clozeFor,quizFor}=EnglishAICore;
const {normalizeWord,localDefinition,parseDictionary,parseTranslation,readWordbook,writeWordbook,upsertWord}=EnglishAIVocab;
let cues=[],idx=-1,videoURL=null,recURL=null,stream=null,recorder=null,chunks=[],recognition=null,clozeOffset=0,quizIndex=0,quizAnswered=false,activeUtterance=null;
let storage=null;try{storage=window.localStorage}catch{}
let wordbook=storage?readWordbook(storage):[],currentWord=null,wordRequest=0,reviewIndex=0;
const sample='1\n00:00:01,000 --> 00:00:04,000\nHello, how are you?\n你好，你好吗？\n\n2\n00:00:04,000 --> 00:00:07,000\nI am learning English every day.\n我每天都在学习英语。\n\n3\n00:00:07,000 --> 00:00:10,000\nPractice makes progress.\n练习带来进步。\n\n4\n00:00:10,000 --> 00:00:13,000\nLet us try one more time.\n我们再试一次。';

function setFeedback(id,message,kind=''){
  const el=$(id);el.textContent=message;el.className='feedback '+kind;
}
function currentCue(){return idx>=0?cues[idx]:null}
function renderWords(root,text,cue){
  for(const part of text.split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/g)){
    if(/^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(part)){
      const button=document.createElement('button');button.type='button';button.className='word-token';button.textContent=part;
      button.setAttribute('aria-label','查看单词 '+part);button.onclick=event=>{event.stopPropagation();openWord(part,cue)};
      root.append(button);
    }else if(part)root.append(document.createTextNode(part));
  }
}
function renderLines(){
  const root=$('lines');root.replaceChildren();$('cueCount').textContent=cues.length+' 句';
  if(!cues.length){root.textContent='没有有效字幕，请导入 SRT / VTT 或载入示例。';return}
  cues.forEach((cue,i)=>{const el=document.createElement('div');el.className='line'+(i===idx?' active':'');el.setAttribute('role','button');el.tabIndex=0;const en=document.createElement('span');en.append(document.createTextNode((i+1)+'. '));renderWords(en,cue.en,cue);const zh=document.createElement('span');zh.className='zh';zh.textContent=cue.zh;el.append(en,zh);el.onclick=()=>select(i,true);el.onkeydown=event=>{if(event.target===el&&(event.key==='Enter'||event.key===' ')){event.preventDefault();select(i,true)}};root.append(el)});
}
function renderPractice(){
  const cue=currentCue();document.querySelector('[data-current-en]').textContent=cue?.en||'请先载入字幕。';
  $('clozeFeedback').classList.add('hidden');$('dictationFeedback').classList.add('hidden');$('speechFeedback').classList.add('hidden');
  $('dictationInput').value='';$('clozeInput').value='';
  const cloze=cue&&clozeFor(cue,clozeOffset);$('clozePrompt').textContent=cloze?.prompt||'请先载入英文字幕。';
  renderQuiz();
}
function select(i,play=false){
  if(i<0||i>=cues.length)return;
  idx=i;clozeOffset=0;const cue=cues[i],current=$('current');current.replaceChildren();renderWords(current,cue.en,cue);
  if(cue.zh){const zh=document.createElement('div');zh.className='zh';zh.textContent=cue.zh;current.append(zh)}
  renderLines();renderPractice();
  if(videoURL){$('player').currentTime=cue.start;if(play)$('player').play().catch(()=>{})}
}
function loadCues(text,source){
  cues=parseSubtitles(text);idx=-1;quizIndex=0;
  $('sourceStatus').textContent=cues.length?source+'：已载入 '+cues.length+' 句字幕。':'未找到有效字幕，请检查时间轴和英文内容。';
  renderLines();if(cues.length)select(0,false);else{$('current').textContent='请先载入字幕。';renderPractice()}
}
function setPlayStatus(message){$('playStatus').textContent=message;$('ttsStatus').textContent=message}
function playCurrent(){
  if(idx<0&&cues.length)select(0);
  if(!currentCue()){setPlayStatus('请先载入字幕。');return}
  if(!videoURL){speak();return}
  const video=$('player');video.currentTime=currentCue().start;
  video.play().then(()=>setPlayStatus('正在播放视频原句。')).catch(()=>setPlayStatus('视频无法播放，请检查文件格式。'));
}
function speak(){
  const cue=currentCue();if(!cue){setPlayStatus('请先载入英文字幕。');return}
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){setPlayStatus('当前浏览器不支持英文朗读。');return}
  const utterance=new window.SpeechSynthesisUtterance(cue.en);activeUtterance=utterance;utterance.lang='en-US';utterance.rate=1;utterance.volume=1;
  const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>v.lang.toLowerCase()==='en-us')||voices.find(v=>v.lang.toLowerCase().startsWith('en'));
  if(voice)utterance.voice=voice;
  let started=false;
  utterance.onstart=()=>{started=true;setPlayStatus('设备正在朗读英文。请调高媒体音量。')};
  utterance.onend=()=>{if(activeUtterance===utterance){activeUtterance=null;setPlayStatus('朗读结束。')}};
  utterance.onerror=e=>{if(activeUtterance===utterance){activeUtterance=null;setPlayStatus('朗读失败：'+(e.error||'未知错误')+'。请用 Safari 打开并检查设备语音设置。')}};
  setPlayStatus('正在启动设备英文语音…');window.speechSynthesis.speak(utterance);
  setTimeout(()=>{if(activeUtterance===utterance&&!started){activeUtterance=null;window.speechSynthesis.cancel();setPlayStatus('语音未能启动。请用 Safari 打开、调高媒体音量，再点一次“播放本句”。')}},5000);
}
function feedbackText(expected,actual){
  const result=compareText(expected,actual);
  if(!actual.trim())return{message:'先输入或识别一句英文。',kind:'needs-work'};
  if(result.exact)return{message:'文字匹配。参考句：'+expected,kind:'good'};
  const parts=['参考句：'+expected];
  if(result.missing.length)parts.push('缺少或不同的词：'+result.missing.join('、'));
  if(result.extra.length)parts.push('多出或不同的词：'+result.extra.join('、'));
  parts.push('仅比较文字，不评估发音。');
  return{message:parts.join('\n'),kind:'needs-work'};
}
function renderQuiz(){
  const quiz=quizFor(cues,quizIndex);const root=$('quizOptions');root.replaceChildren();$('quizFeedback').classList.add('hidden');quizAnswered=false;
  $('quizQuestion').textContent=quiz?.question||'请载入至少 3 句英文和中文均完整、译文不同的字幕。';
  if(!quiz)return;
  quiz.options.forEach(option=>{const button=document.createElement('button');button.type='button';button.textContent=option;button.onclick=()=>{if(quizAnswered)return;quizAnswered=true;const correct=option===quiz.answer;button.classList.add(correct?'correct':'wrong');setFeedback('quizFeedback',correct?'答对了。':'这句的参考译文是：'+quiz.answer,correct?'good':'needs-work');root.querySelectorAll('button').forEach(b=>{b.disabled=true;if(b.textContent===quiz.answer)b.classList.add('correct')})};root.append(button)});
}
function renderWordMeaning(){
  if(!currentWord)return;
  $('wordPhonetic').textContent=[currentWord.phonetic,currentWord.partOfSpeech].filter(Boolean).join(' · ');
  $('wordTranslation').textContent=currentWord.translation||'暂无中文词义';
  $('wordDefinition').textContent=currentWord.definition?'英文释义：'+currentWord.definition:'英文释义暂不可用';
  $('wordExample').textContent=currentWord.example?'词典例句：'+currentWord.example:'';
  $('wordContext').textContent='所在句：'+currentWord.sentence+(currentWord.sentenceZh?'\n整句译文：'+currentWord.sentenceZh:'');
}
async function dictionaryJson(url){
  const response=await fetch(url);if(!response.ok)throw Error('词典暂不可用');return response.json();
}
async function openWord(value,cue){
  const word=normalizeWord(value);if(!word)return;
  const request=++wordRequest,saved=wordbook.find(item=>item.word===word),seed=localDefinition(word);
  currentWord={word,translation:saved?.translation||seed?.translation||'',definition:saved?.definition||seed?.definition||'',phonetic:saved?.phonetic||'',partOfSpeech:saved?.partOfSpeech||'',example:saved?.example||'',sentence:cue.en,sentenceZh:cue.zh||'',note:saved?.note||''};
  $('wordTitle').textContent=value;$('wordNote').value=currentWord.note;$('wordSheet').classList.remove('hidden');
  $('wordStatus').textContent='正在查询词典…';renderWordMeaning();$('closeWord').focus();
  const translationUrl='https://api.mymemory.translated.net/get?q='+encodeURIComponent(word)+'&langpair=en%7Czh-CN';
  const results=await Promise.allSettled([
    dictionaryJson('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word)),
    dictionaryJson(translationUrl)
  ]);
  if(request!==wordRequest||!currentWord||currentWord.word!==word)return;
  const dictionary=results[0].status==='fulfilled'?parseDictionary(results[0].value):null;
  const translation=results[1].status==='fulfilled'?parseTranslation(results[1].value):'';
  if(dictionary)Object.assign(currentWord,dictionary);
  if(translation&&!seed)currentWord.translation=translation;
  renderWordMeaning();
  $('wordStatus').textContent=dictionary||translation||seed?'词义仅供参考；可以收藏或写下自己的理解。':'在线词典暂不可用；仍可根据整句译文写笔记并保存。';
}
function renderReview(){
  if(!wordbook.length){$('reviewWord').textContent='收藏单词后可复习。';$('reviewCount').textContent='0 / 0';$('reviewAnswer').classList.add('hidden');return}
  reviewIndex%=wordbook.length;const item=wordbook[reviewIndex];
  $('reviewWord').textContent=item.word;$('reviewCount').textContent=(reviewIndex+1)+' / '+wordbook.length;
  $('reviewAnswer').textContent=[item.translation,item.definition,item.note?'笔记：'+item.note:''].filter(Boolean).join('\n')||'暂无释义，可点上方单词补充笔记。';
  $('reviewAnswer').classList.add('hidden');
}
function renderWordbook(){
  $('wordCount').textContent=wordbook.length;const list=$('wordList');list.replaceChildren();
  if(!wordbook.length)list.textContent='还没有收藏单词。点字幕中的英文单词开始。';
  wordbook.forEach(item=>{
    const row=document.createElement('div');row.className='word-row';
    const open=document.createElement('button');open.type='button';open.textContent=item.word;
    const detail=document.createElement('small');detail.textContent=item.translation+(item.note?' · 有笔记':'');open.append(detail);
    open.onclick=()=>openWord(item.word,{en:item.sentence||item.word,zh:item.sentenceZh||''});
    const remove=document.createElement('button');remove.type='button';remove.className='remove-word';remove.textContent='移除';remove.setAttribute('aria-label','移除 '+item.word);
    remove.onclick=()=>{wordbook=wordbook.filter(x=>x.word!==item.word);if(storage)writeWordbook(storage,wordbook);reviewIndex=0;renderWordbook()};
    row.append(open,remove);list.append(row);
  });
  const notes=$('noteList');notes.replaceChildren();
  const withNotes=wordbook.filter(item=>item.note);
  if(!withNotes.length)notes.textContent='还没有笔记。点单词后写下自己的理解。';
  withNotes.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='note-row';button.textContent=item.word+'：'+item.note;button.onclick=()=>openWord(item.word,{en:item.sentence||item.word,zh:item.sentenceZh||''});notes.append(button)});
  renderReview();
}
function saveCurrentWord(requireNote){
  if(!currentWord)return;
  const note=$('wordNote').value.trim();
  if(requireNote&&!note){$('wordStatus').textContent='先在“我的笔记”写一句话，再加入笔记本。';$('wordNote').focus();return}
  currentWord.note=note;
  wordbook=upsertWord(wordbook,{...currentWord,savedAt:new Date().toISOString()});
  const persisted=storage&&writeWordbook(storage,wordbook);
  $('wordStatus').textContent=persisted?(requireNote?'已加入笔记本，稍后可以复习。':'已收藏到单词本。'):'已临时收藏；此浏览器未允许永久存储。';
  reviewIndex=0;renderWordbook();
}
$('openWordbook').onclick=()=>{$('wordbook').classList.remove('hidden');renderWordbook()};
$('closeWordbook').onclick=()=>$('wordbook').classList.add('hidden');
$('closeWord').onclick=()=>{$('wordSheet').classList.add('hidden');wordRequest++;currentWord=null};
$('wordSheet').onclick=event=>{if(event.target===$('wordSheet'))$('closeWord').click()};
$('saveWord').onclick=()=>saveCurrentWord(false);
$('saveNote').onclick=()=>saveCurrentWord(true);
$('revealWord').onclick=()=>$('reviewAnswer').classList.remove('hidden');
$('nextWord').onclick=()=>{if(wordbook.length){reviewIndex++;renderReview()}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('wordSheet').classList.contains('hidden'))$('closeWord').click()});
document.querySelectorAll('.mode').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('.mode').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
  document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!==button.dataset.mode));
});
$('videoFile').onchange=e=>{const file=e.target.files[0];if(!file)return;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);$('player').src=videoURL;$('sourceStatus').textContent='已选择视频：'+file.name+'。现在导入字幕即可逐句练习。'};
$('subtitleFile').onchange=async e=>{const file=e.target.files[0];if(file)loadCues(await file.text(),file.name)};
$('sample').onclick=()=>loadCues(sample,'示例字幕');
$('clear').onclick=()=>loadCues('','已清空');
$('parsePaste').onclick=()=>loadCues($('paste').value,'粘贴字幕');
$('prev').onclick=()=>select(Math.max(0,idx-1),true);
$('next').onclick=()=>select(Math.min(cues.length-1,idx+1),true);
$('play').onclick=playCurrent;$('replayVideo').onclick=playCurrent;
$('player').addEventListener('timeupdate',()=>{const cue=currentCue(),video=$('player');if(!cue||video.currentTime<cue.end)return;if($('loop').checked){video.currentTime=cue.start;if(video.paused)video.play().catch(()=>{})}else video.pause()});
$('speakShadow').onclick=speak;$('hearDictation').onclick=speak;
$('checkDictation').onclick=()=>{const cue=currentCue();if(!cue){setFeedback('dictationFeedback','请先载入字幕。','needs-work');return}const result=feedbackText(cue.en,$('dictationInput').value);setFeedback('dictationFeedback',result.message,result.kind)};
$('checkCloze').onclick=()=>{const cue=currentCue(),cloze=cue&&clozeFor(cue,clozeOffset);if(!cloze){setFeedback('clozeFeedback','请先载入英文字幕。','needs-work');return}const result=compareText(cloze.answer,$('clozeInput').value);setFeedback('clozeFeedback',result.exact?'答对了：'+cloze.answer:'参考答案：'+cloze.answer,result.exact?'good':'needs-work')};
$('newCloze').onclick=()=>{clozeOffset++;$('clozeInput').value='';$('clozeFeedback').classList.add('hidden');$('clozePrompt').textContent=currentCue()?clozeFor(currentCue(),clozeOffset).prompt:'请先载入英文字幕。'};
$('nextQuiz').onclick=()=>{quizIndex++;renderQuiz()};
$('record').onclick=async()=>{
  try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('当前页面不支持录音，请在 HTTPS 页面允许麦克风');
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const types=['audio/mp4','audio/webm;codecs=opus','audio/webm'];const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onstop=()=>{if(recURL)URL.revokeObjectURL(recURL);const blob=new Blob(chunks,{type:recorder.mimeType||'audio/mp4'});recURL=URL.createObjectURL(blob);$('recorded').src=recURL;$('recorded').classList.remove('hidden');$('recStatus').textContent='录音完成，可以播放对比。';stream?.getTracks().forEach(t=>t.stop());stream=null;$('record').disabled=false;$('stop').disabled=true};
    recorder.start();$('record').disabled=true;$('stop').disabled=false;$('recStatus').textContent='正在录音…';
  }catch(error){stream?.getTracks().forEach(t=>t.stop());stream=null;$('recStatus').textContent='无法录音：'+error.message}
};
$('stop').onclick=()=>{if(recorder?.state==='recording')recorder.stop()};
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
$('speechSupport').textContent=!window.isSecureContext?'语音识别需要 HTTPS 安全页面。':!Recognition?(isiOS?'此 iPhone 浏览器未提供语音识别接口，可继续录音回放。':'当前浏览器未提供语音识别接口。'):(isiOS?'检测到 iPhone 语音识别接口，实际可用性取决于 Safari 版本、网络和麦克风权限。':'检测到浏览器语音识别接口，需允许麦克风；识别可能依赖网络。');
$('recognize').disabled=!Recognition||!window.isSecureContext;
$('recognize').onclick=()=>{
  if(!currentCue()){setFeedback('speechFeedback','请先载入英文字幕。','needs-work');return}
  try{
    const expected=currentCue().en;
    recognition?.abort();recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=e=>{const transcript=e.results[0][0].transcript;const result=feedbackText(expected,transcript);setFeedback('speechFeedback','识别文字：'+transcript+'\n'+result.message,result.kind)};
    recognition.onerror=e=>setFeedback('speechFeedback','识别失败：'+e.error+'。可以改用录音回放。','needs-work');
    recognition.onend=()=>{$('recognize').disabled=false};
    $('recognize').disabled=true;setFeedback('speechFeedback','正在聆听，请朗读当前句。');recognition.start();
  }catch(error){$('recognize').disabled=false;setFeedback('speechFeedback','无法开始识别：'+error.message,'needs-work')}
};
renderLines();renderPractice();renderWordbook();
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
