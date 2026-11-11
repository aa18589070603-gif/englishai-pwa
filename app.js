const $=id=>document.getElementById(id);
const {parseSubtitles,compareText,clozeFor,quizFor}=EnglishAICore;
let cues=[],idx=-1,videoURL=null,recURL=null,stream=null,recorder=null,chunks=[],recognition=null,clozeOffset=0,quizIndex=0,quizAnswered=false;
const sample='1\n00:00:01,000 --> 00:00:04,000\nHello, how are you?\n你好，你好吗？\n\n2\n00:00:04,000 --> 00:00:07,000\nI am learning English every day.\n我每天都在学习英语。\n\n3\n00:00:07,000 --> 00:00:10,000\nPractice makes progress.\n练习带来进步。\n\n4\n00:00:10,000 --> 00:00:13,000\nLet us try one more time.\n我们再试一次。';

function setFeedback(id,message,kind=''){
  const el=$(id);el.textContent=message;el.className='feedback '+kind;
}
function currentCue(){return idx>=0?cues[idx]:null}
function renderLines(){
  const root=$('lines');root.replaceChildren();$('cueCount').textContent=cues.length+' 句';
  if(!cues.length){root.textContent='没有有效字幕，请导入 SRT / VTT 或载入示例。';return}
  cues.forEach((cue,i)=>{const el=document.createElement('button');el.type='button';el.className='line'+(i===idx?' active':'');const en=document.createElement('span');en.textContent=(i+1)+'. '+cue.en;const zh=document.createElement('span');zh.className='zh';zh.textContent=cue.zh;el.append(en,zh);el.onclick=()=>select(i,true);root.append(el)});
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
  idx=i;clozeOffset=0;const cue=cues[i];$('current').textContent=cue.en+(cue.zh?'\n'+cue.zh:'');
  renderLines();renderPractice();
  if(videoURL){$('player').currentTime=cue.start;if(play)$('player').play().catch(()=>{})}
}
function loadCues(text,source){
  cues=parseSubtitles(text);idx=-1;quizIndex=0;
  $('sourceStatus').textContent=cues.length?source+'：已载入 '+cues.length+' 句字幕。':'未找到有效字幕，请检查时间轴和英文内容。';
  renderLines();if(cues.length)select(0,false);else{$('current').textContent='请先载入字幕。';renderPractice()}
}
function playCurrent(){if(idx<0&&cues.length)select(0);if(!currentCue()){setFeedback('ttsStatus','请先载入字幕。');return}if(!videoURL){setFeedback('ttsStatus','请先选择视频；也可以点“英文朗读”。');return}const video=$('player');video.currentTime=currentCue().start;video.play().catch(()=>setFeedback('ttsStatus','视频无法播放，请检查文件格式。'))}
function speak(){
  const cue=currentCue();if(!cue){$('ttsStatus').textContent='请先载入英文字幕。';return}
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){$('ttsStatus').textContent='当前浏览器不支持英文朗读。';return}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(cue.en);utterance.lang='en-US';utterance.rate=.88;
  const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang.toLowerCase()==='en-us')||voices.find(v=>v.lang.toLowerCase().startsWith('en'))||null;
  utterance.onerror=()=>{$('ttsStatus').textContent='朗读失败，请检查设备语音设置。'};
  $('ttsStatus').textContent='正在使用设备英文语音朗读。';speechSynthesis.speak(utterance);
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
renderLines();renderPractice();
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
