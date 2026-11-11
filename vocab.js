(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishAIVocab=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const KEY='englishai-v2-wordbook';
  const SAMPLE={
    hello:['你好；打招呼用语','a greeting'],how:['怎样；如何','in what way'],are:['是','a form of be'],you:['你；你们','the person being addressed'],
    learning:['学习','gaining knowledge or a skill'],english:['英语','the English language'],every:['每一个','each one'],day:['一天；白天','a period of 24 hours'],
    practice:['练习','repeated work to improve a skill'],makes:['使得；造成','causes something to happen'],progress:['进步','forward movement or improvement'],
    let:['让','allow or permit'],us:['我们','the speaker and others'],try:['尝试','make an attempt'],one:['一个','the number one'],
    more:['更多的；再','an additional amount'],time:['时间；一次','a period or an occasion']
  };
  function normalizeWord(value){return(String(value).toLowerCase().match(/[a-z]+(?:['’][a-z]+)?/)||[])[0]||''}
  function localDefinition(word){const item=SAMPLE[normalizeWord(word)];return item?{translation:item[0],definition:item[1]}:null}
  function parseDictionary(json){const first=Array.isArray(json)?json[0]:null;if(!first)return null;const meanings=Array.isArray(first.meanings)?first.meanings:[];const sense=meanings.flatMap(m=>(m.definitions||[]).map(d=>({partOfSpeech:m.partOfSpeech||'',definition:d.definition||'',example:d.example||''}))).find(x=>x.definition);if(!sense)return null;return{phonetic:first.phonetic||first.phonetics?.find(x=>x.text)?.text||'',...sense}}
  function parseTranslation(json){const text=json?.responseData?.translatedText;return typeof text==='string'&&text.trim()?text.trim():''}
  function readWordbook(storage){try{const items=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.word==='string'&&normalizeWord(x.word)).slice(0,500):[]}catch{return[]}}
  function writeWordbook(storage,items){try{storage.setItem(KEY,JSON.stringify(items.slice(0,500)));return true}catch{return false}}
  function upsertWord(items,entry){const word=normalizeWord(entry.word);if(!word)return items;const previous=items.find(x=>normalizeWord(x.word)===word)||{};const clean={...previous,...entry,word};return[clean,...items.filter(x=>normalizeWord(x.word)!==word)].slice(0,500)}
  function dueWords(items,now=Date.now()){return items.filter(item=>!item.nextReviewAt||!Number.isFinite(Date.parse(item.nextReviewAt))||Date.parse(item.nextReviewAt)<=now)}
  function rateReview(items,value,remembered,now=Date.now()){
    const word=normalizeWord(value),item=items.find(x=>normalizeWord(x.word)===word);if(!item)return items;
    const streak=remembered?Math.min((Number(item.reviewStreak)||0)+1,5):0;
    const days=[1,3,7,14,30][streak-1]||1;
    const updated={...item,reviewStreak:streak,reviewCount:(Number(item.reviewCount)||0)+1,lastReviewedAt:new Date(now).toISOString(),nextReviewAt:remembered?new Date(now+days*86400000).toISOString():null};
    return remembered?items.map(x=>normalizeWord(x.word)===word?updated:x):[...items.filter(x=>normalizeWord(x.word)!==word),updated];
  }
  return{KEY,normalizeWord,localDefinition,parseDictionary,parseTranslation,readWordbook,writeWordbook,upsertWord,dueWords,rateReview};
});
