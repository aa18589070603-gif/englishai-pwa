(function(){
  const $=id=>document.getElementById(id);
  const api='/api/dialogue';
  let ready=false,busy=false,messages=[],lastReply='',recognition=null;
  const box=$('dialogueMessages');
  function status(message){$('dialogueStatus').textContent=message}
  function bubble(role,text){
    const item=document.createElement('div');item.className='dialogue-bubble '+role;
    const name=document.createElement('strong');name.textContent=role==='user'?'我':role==='assistant'?'AI 教练':'开始练习';
    const content=document.createElement('span');content.textContent=text;item.append(name,content);box.append(item);box.scrollTop=box.scrollHeight;
    return item;
  }
  function reset(){messages=[];lastReply='';box.replaceChildren();bubble('intro','选好话题后，用英文发出第一句话。');$('dialogueInput').value='';$('hearDialogue').disabled=true;status(ready?'可以开始对话。':'AI 服务尚未连接。')}
  function connection(available,message){
    ready=available;$('sendDialogue').disabled=!ready||busy;
    $('dialogueBadge').textContent=ready?'已连接':'待接入';$('dialogueBadge').classList.toggle('pending',!ready);
    status(message);
  }
  async function checkConnection(){
    try{
      const response=await fetch(api,{headers:{accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      connection(response.ok&&data.ready===true,data.ready?'AI 服务已连接，可以开始对话。':'AI 服务尚未配置，请站点管理员连接服务。');
    }catch{connection(false,'这个预览尚无 AI 服务。请部署包含服务端功能的版本。')}
  }
  async function send(){
    if(!ready||busy)return;
    const value=$('dialogueInput').value.trim();
    if(!value){status('先输入一句英文。');return}
    busy=true;$('sendDialogue').disabled=true;$('dictateDialogue').disabled=true;
    const pending=bubble('user',value),history=[...messages,{role:'user',content:value}].slice(-12);
    status('AI 正在回复…');
    try{
      const response=await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:$('dialogueTopic').value,messages:history})});
      const data=await response.json();
      if(!response.ok||typeof data.reply!=='string'||!data.reply.trim())throw Error(data.error||'暂时没有收到回复。');
      messages=[...history,{role:'assistant',content:data.reply}].slice(-10);
      lastReply=data.reply;bubble('assistant',lastReply);$('dialogueInput').value='';$('hearDialogue').disabled=false;
      status('已收到回复。可以点“听回复”，再继续用英文回答。');
    }catch(error){pending.remove();status(error.message||'发送失败，请稍后重试。')}
    finally{busy=false;$('sendDialogue').disabled=!ready;$('dictateDialogue').disabled=!SpeechRecognitionSupported}
  }
  function hearReply(){
    if(!lastReply)return;
    if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){status('当前浏览器不支持设备英文朗读。');return}
    const utterance=new window.SpeechSynthesisUtterance(lastReply);utterance.lang='en-US';utterance.rate=.9;
    const voices=window.speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang.toLowerCase()==='en-us')||voices.find(v=>v.lang.toLowerCase().startsWith('en'))||null;
    utterance.onstart=()=>status('正在朗读 AI 回复…');utterance.onerror=()=>status('朗读失败，请检查媒体音量。');utterance.onend=()=>status('朗读结束。');
    window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);status('正在启动设备英文语音…');
  }
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const SpeechRecognitionSupported=Boolean(Recognition&&window.isSecureContext);
  $('dictateDialogue').disabled=!SpeechRecognitionSupported;
  $('dialogueSpeechSupport').textContent=SpeechRecognitionSupported?'语音输入会使用浏览器识别服务；识别文本可修改后再发送。':'当前浏览器无法使用语音输入，可直接键入英文。';
  function dictate(){
    if(!SpeechRecognitionSupported)return;
    try{
      recognition?.abort();recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onresult=event=>{$('dialogueInput').value=event.results[0][0].transcript;status('已填入识别文字，请检查后点“发送给 AI”。')};
      recognition.onerror=()=>status('语音输入失败，可以改用键盘输入。');
      recognition.onend=()=>{$('dictateDialogue').disabled=busy};
      $('dictateDialogue').disabled=true;recognition.start();status('正在听，请说一句英文。');
    }catch{$('dictateDialogue').disabled=false;status('无法开始语音输入，请改用键盘。')}
  }
  $('sendDialogue').onclick=send;$('hearDialogue').onclick=hearReply;$('dictateDialogue').onclick=dictate;
  $('resetDialogue').onclick=reset;$('dialogueTopic').onchange=reset;
  reset();checkConnection();
})();
