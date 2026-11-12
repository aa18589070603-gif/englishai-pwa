const $=id=>document.getElementById(id);
const {parseSubtitles,compareText,clozeFor,quizFor}=EnglishAICore;
const {normalizeWord,localDefinition,parseDictionary,parseTranslation,readWordbook,writeWordbook,upsertWord,dueWords,rateReview,makeBackup,parseBackup,mergeWordbooks}=EnglishAIVocab;
const mediaStore=typeof EnglishAIMedia==='undefined'?null:EnglishAIMedia;
let cues=[],idx=-1,videoURL=null,activeVideoId=null,trackProgress=true,positionSave=Promise.resolve(),recURL=null,stream=null,recorder=null,chunks=[],recognition=null,clozeOffset=0,quizIndex=0,quizAnswered=false,activeUtterance=null;
let mediaRevision=0;
let storage=null;try{storage=window.localStorage}catch{}
let wordbook=storage?readWordbook(storage):[],currentWord=null,wordRequest=0,reviewIndex=0,reviewAll=false;
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
function select(i,play=false,remember=true){
  if(i<0||i>=cues.length)return;
  idx=i;clozeOffset=0;const cue=cues[i],current=$('current');current.replaceChildren();renderWords(current,cue.en,cue);
  if(cue.zh){const zh=document.createElement('div');zh.className='zh';zh.textContent=cue.zh;current.append(zh)}
  renderLines();renderPractice();
  if(videoURL){$('player').currentTime=cue.start;if(play)$('player').play().catch(()=>{})}
  if(remember&&trackProgress&&mediaStore&&activeVideoId){const id=activeVideoId;positionSave=positionSave.catch(()=>{}).then(()=>mediaStore.savePosition(id,i))}
}
function loadCues(text,source,startIndex=0,track=true){
  cues=parseSubtitles(text);idx=-1;quizIndex=0;trackProgress=track;
  $('sourceStatus').textContent=cues.length?source+'：已载入 '+cues.length+' 句字幕。':'未找到有效字幕，请检查时间轴和英文内容。';
  renderLines();if(cues.length)select(Math.min(Math.max(0,startIndex),cues.length-1),false,false);else{$('current').textContent='请先载入字幕。';renderPractice()}
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
function reviewQueue(){return reviewAll?wordbook:dueWords(wordbook)}
function renderReview(){
  const queue=reviewQueue(),due=dueWords(wordbook).length;
  $('dueCount').textContent=due+' 个单词待复习'+(reviewAll?' · 正在浏览全部':'');
  $('reviewAll').textContent=reviewAll?'只看待复习':'复习全部';
  for(const id of ['hearReviewWord','revealWord','rememberWord','againWord','nextWord'])$(id).disabled=!queue.length;
  $('reviewAll').disabled=!wordbook.length;
  $('reviewSpeechStatus').textContent='';
  if(!queue.length){$('reviewWord').textContent=wordbook.length?'本轮复习完成。想继续练习可点“复习全部”。':'收藏单词后可复习。';$('reviewCount').textContent='0 / 0';$('reviewAnswer').classList.add('hidden');return}
  reviewIndex%=queue.length;const item=queue[reviewIndex];
  $('reviewWord').textContent=item.word;$('reviewCount').textContent=(reviewIndex+1)+' / '+queue.length;
  $('reviewAnswer').textContent=[item.translation,item.definition,item.note?'笔记：'+item.note:''].filter(Boolean).join('\n')||'暂无释义，可点上方单词补充笔记。';
  $('reviewAnswer').classList.add('hidden');
}
function pronounceReviewWord(){
  const queue=reviewQueue();if(!queue.length)return;
  const status=$('reviewSpeechStatus');
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){
    status.textContent='当前浏览器不支持英文发音。';return;
  }
  const word=queue[reviewIndex%queue.length].word;
  activeUtterance=null;window.speechSynthesis.cancel();
  const utterance=new window.SpeechSynthesisUtterance(word);activeUtterance=utterance;
  utterance.lang='en-US';utterance.rate=.85;utterance.volume=1;
  const voices=window.speechSynthesis.getVoices();
  const voice=voices.find(v=>v.lang.toLowerCase()==='en-us')||voices.find(v=>v.lang.toLowerCase().startsWith('en'));
  if(voice)utterance.voice=voice;
  let started=false;
  utterance.onstart=()=>{started=true;status.textContent='正在朗读：'+word};
  utterance.onend=()=>{if(activeUtterance===utterance){activeUtterance=null;status.textContent='朗读结束。'}};
  utterance.onerror=e=>{if(activeUtterance===utterance){activeUtterance=null;status.textContent='发音失败：'+(e.error||'未知错误')+'。请检查媒体音量。'}};
  status.textContent='正在启动英文发音…';window.speechSynthesis.speak(utterance);
  setTimeout(()=>{if(activeUtterance===utterance&&!started){activeUtterance=null;window.speechSynthesis.cancel();status.textContent='发音未能启动。请用 Safari 打开、调高媒体音量后再点一次。'}},5000);
}
function renderWordbook(){
  $('wordCount').textContent=wordbook.length;$('exportWordbook').disabled=!wordbook.length;const list=$('wordList');list.replaceChildren();
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
$('exportWordbook').onclick=()=>{
  if(!wordbook.length)return;
  const blob=new Blob([JSON.stringify(makeBackup(wordbook),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='EnglishAI-wordbook-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('backupStatus').textContent='已生成单词本备份。请把 JSON 文件保存到“文件”或电脑中。';
};
$('importWordbookButton').onclick=()=>$('importWordbookFile').click();
$('importWordbookFile').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>1024*1024)throw Error('备份文件超过 1 MB。');
    const incoming=parseBackup(await file.text()),previous=wordbook.length;
    wordbook=mergeWordbooks(wordbook,incoming);
    const saved=storage&&writeWordbook(storage,wordbook);
    reviewIndex=0;renderWordbook();
    $('backupStatus').textContent=saved?'已导入 '+(wordbook.length-previous)+' 个新单词；已有单词和笔记保持原样。':'已在本次页面载入，但浏览器未允许永久保存。';
  }catch(error){$('backupStatus').textContent='导入失败：'+error.message}
  event.target.value='';
};
$('revealWord').onclick=()=>$('reviewAnswer').classList.remove('hidden');
$('hearReviewWord').onclick=pronounceReviewWord;
$('reviewAll').onclick=()=>{reviewAll=!reviewAll;reviewIndex=0;renderReview()};
function rateCurrentWord(remembered){
  const queue=reviewQueue();if(!queue.length)return;
  wordbook=rateReview(wordbook,queue[reviewIndex%queue.length].word,remembered);
  if(storage)writeWordbook(storage,wordbook);
  reviewIndex=reviewAll&&remembered?reviewIndex+1:reviewAll?reviewIndex:0;renderWordbook();
}
$('rememberWord').onclick=()=>rateCurrentWord(true);
$('againWord').onclick=()=>rateCurrentWord(false);
$('nextWord').onclick=()=>{if(reviewQueue().length){activeUtterance=null;window.speechSynthesis?.cancel();reviewIndex++;renderReview()}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('wordSheet').classList.contains('hidden'))$('closeWord').click()});
document.querySelectorAll('.mode').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('.mode').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
  document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!==button.dataset.mode));
});
let pendingVideoSave=Promise.resolve();
function showVideo(video){
  if(videoURL)URL.revokeObjectURL(videoURL);
  activeVideoId=video.id||null;
  videoURL=URL.createObjectURL(video.blob);$('player').src=videoURL;
}
async function renderSavedVideos(){
  if(!mediaStore)return;
  const list=$('savedVideoList');list.replaceChildren();
  try{
    const videos=await mediaStore.listVideos();$('savedVideoCount').textContent=videos.length;
    if(!videos.length){list.textContent='还没有保存视频。';return}
    for(const video of videos){
      const row=document.createElement('div');row.className='saved-media-row';
      const name=document.createElement('span');name.className='media-name';name.textContent=video.name;
      const detail=document.createElement('small');const position=await mediaStore.getPosition(video.id);detail.textContent=(video.size/1048576).toFixed(1)+' MB'+(video.subtitleText?' · 有字幕':'')+(position?' · 上次第 '+(position+1)+' 句':'');name.append(detail);
      const open=document.createElement('button');open.type='button';open.className='ghost';open.textContent='打开';
      open.onclick=async()=>{try{mediaRevision++;const selected=await mediaStore.activateVideo(video.id),subtitles=await mediaStore.getSubtitlesFor(selected),position=await mediaStore.getPosition(selected.id);showVideo(selected);loadCues(subtitles?.text||'',subtitles?.name||'未保存字幕',position);$('localSaveStatus').textContent='已打开保存的视频：'+selected.name+(subtitles?.text?'，并回到上次练习的句子。':'。请为它导入字幕。')}catch(error){$('localSaveStatus').textContent='无法打开视频：'+error.message}};
      const remove=document.createElement('button');remove.type='button';remove.className='remove-media';remove.textContent='删除';remove.setAttribute('aria-label','删除保存的视频 '+video.name);
      remove.onclick=async()=>{if(!window.confirm('确定从本机删除“'+video.name+'”吗？'))return;try{await mediaStore.deleteVideo(video.id);await renderSavedVideos();$('localSaveStatus').textContent='已删除本机保存的视频：'+video.name+'。当前播放不会立即中断。'}catch(error){$('localSaveStatus').textContent='删除失败：'+error.message}};
      row.append(name,open,remove);list.append(row);
    }
  }catch(error){list.textContent='无法读取已保存的视频：'+error.message}
}
async function restoreMedia(){
  if(!mediaStore){$('localSaveStatus').textContent='当前浏览器不支持本机素材保存；本次仍可正常练习。';return}
  const revision=mediaRevision;
  try{
    const video=await mediaStore.getActiveVideo(),subtitles=await mediaStore.getSubtitlesFor(video),position=await mediaStore.getPosition(video?.id);
    if(revision!==mediaRevision)return;
    const restored=[];
    if(video?.blob){showVideo(video);restored.push('视频 '+video.name)}
    if(subtitles?.text){loadCues(subtitles.text,subtitles.name||'已保存字幕',position);restored.push('字幕'+(position?'（第 '+(idx+1)+' 句）':''))}
    $('localSaveStatus').textContent=restored.length?'已从本机恢复：'+restored.join('、')+'。':'尚无本机保存的视频或字幕。';
    await renderSavedVideos();
  }catch(error){$('localSaveStatus').textContent='无法恢复本机素材：'+error.message}
}
$('videoFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;mediaRevision++;
  showVideo({blob:file});loadCues('','新视频待导入字幕');
  const chosenURL=videoURL;
  $('sourceStatus').textContent='已选择视频：'+file.name+'。现在导入字幕即可逐句练习。';
  if(!mediaStore){$('localSaveStatus').textContent='本次可播放；当前浏览器不支持本机保存。';return}
  $('localSaveStatus').textContent='正在将视频保存到本机…';
  pendingVideoSave=mediaStore.saveVideo(file);
  try{const saved=await pendingVideoSave;if(videoURL===chosenURL)activeVideoId=saved.id;await renderSavedVideos();$('localSaveStatus').textContent='视频已加入本机素材库。请保留原始文件，以防浏览器清理数据。'}
  catch(error){$('localSaveStatus').textContent='视频可在本次使用，但未能保存：'+(error.name==='QuotaExceededError'?'手机存储空间不足；以前保存的视频仍可恢复。':error.message)}
};
$('subtitleFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;mediaRevision++;
  const text=await file.text();loadCues(text,file.name);
  if(mediaStore)try{await pendingVideoSave;await mediaStore.saveSubtitles(text,file.name);await renderSavedVideos();$('localSaveStatus').textContent='字幕已保存到当前视频。'}catch(error){$('localSaveStatus').textContent='字幕已载入，但未能保存：'+error.message}
};
$('sample').onclick=()=>{mediaRevision++;loadCues(sample,'示例字幕',0,false)};
$('clear').onclick=async()=>{mediaRevision++;loadCues('','已清空');if(mediaStore)try{await pendingVideoSave;await mediaStore.clearSubtitles();await renderSavedVideos();$('localSaveStatus').textContent='已清除当前视频保存的字幕。'}catch(error){$('localSaveStatus').textContent='未能清除本机字幕：'+error.message}};
$('parsePaste').onclick=async()=>{mediaRevision++;const text=$('paste').value;loadCues(text,'粘贴字幕');if(mediaStore)try{await pendingVideoSave;await mediaStore.saveSubtitles(text,'粘贴字幕');await renderSavedVideos();$('localSaveStatus').textContent='字幕已保存到当前视频。'}catch(error){$('localSaveStatus').textContent='字幕已载入，但未能保存：'+error.message}};
$('forgetMedia').onclick=async()=>{
  if(!mediaStore)return;
  if(!window.confirm('确定删除本机保存的全部视频和字幕吗？'))return;
  try{await pendingVideoSave;await mediaStore.clearMedia();await renderSavedVideos();$('localSaveStatus').textContent='已删除本机保存的全部视频和字幕；当前页面可继续使用，刷新后不再恢复。'}
  catch(error){$('localSaveStatus').textContent='未能删除本机素材：'+error.message}
};
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
restoreMedia();
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
