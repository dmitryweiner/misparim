'use strict';
const {words,accepts}=HebrewNumbers,$=s=>document.querySelector(s);
const game=$('#game'),level=$('#level'),gender=$('#gender'),auto=$('#auto');
let direction='forward',method='choice',deck=[],index=0,score=0,helped=0,errors=[],answered=false,timer=null,voice=null,speechId=0;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function bounds(){return level.value==='1'?[1,10]:level.value==='2'?[10,100]:[100,999];}
function stop(){clearTimeout(timer);timer=null;speechId++;if('speechSynthesis'in window)window.speechSynthesis.cancel();}
function options(n){const [lo,hi]=bounds();const close=shuffle([n-1,n+1,n-10,n+10,n-100,n+100,n%10*10+Math.floor(n/10)]).filter(x=>x>=lo&&x<=hi&&x!==n);const set=new Set([n]);for(const x of close){if(set.size<4)set.add(x);}while(set.size<4)set.add(lo+Math.floor(Math.random()*(hi-lo+1)));return shuffle([...set]);}
function begin(){stop();const [lo,hi]=bounds();const nums=shuffle(Array.from({length:hi-lo+1},(_,i)=>lo+i)).slice(0,10);deck=nums.map(n=>({n,choices:options(n),hint:false,correct:false,draft:''}));index=0;score=0;helped=0;errors=[];answered=false;render();}
function he(s,cls=''){return `<span lang="he" dir="rtl" class="he ${cls}">${s}</span>`;}
function render(){
 document.querySelectorAll('[data-direction]').forEach(b=>{b.classList.toggle('active',b.dataset.direction===direction);b.setAttribute('aria-pressed',String(b.dataset.direction===direction));});
 document.querySelectorAll('[data-method]').forEach(b=>{b.classList.toggle('active',b.dataset.method===method);b.setAttribute('aria-pressed',String(b.dataset.method===method));});
 if(index===deck.length)return result();
 const q=deck[index],forward=direction==='forward',text=words(q.n,gender.value);
 const choiceHTML=`<div class="choices">${q.choices.map(n=>`<button class="choice ${forward?'he':''}" data-number="${n}" ${forward?'lang="he" dir="rtl"':''}>${forward?words(n,gender.value):n}</button>`).join('')}</div>`;
 const inputHTML=`<form id="answer-form"><label class="answer-label" for="answer">${forward?'Напиши число словами на иврите':'Впиши число цифрами'}</label><div class="input-row"><input id="answer" type="text" ${forward?'lang="he" dir="rtl" class="he"':'inputmode="numeric" dir="ltr"'} autocomplete="off" spellcheck="false" maxlength="100" enterkeyhint="done" aria-describedby="input-error"><button type="submit" class="primary">Проверить</button></div><p id="input-error" class="error" aria-live="polite"></p></form>${forward?'<button class="keyboard-toggle" id="keyboard-toggle" aria-expanded="false" aria-controls="keyboard">Клавиатура א–ת</button><div class="keyboard" id="keyboard" hidden></div>':''}`;
 game.innerHTML=`<div class="round"><span>Вопрос ${index+1} из 10</span><span class="tag">${gender.value==='f'?'Женская форма':'Мужская форма'}</span></div><div class="stats" id="stats">Самостоятельно: ${score} · С подсказкой: ${helped} · Ошибки: ${errors.length}</div><div class="progress" role="progressbar" aria-label="Пройдено вопросов" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${index}"><i style="width:${index*10}%"></i></div><h1 class="prompt">${forward?'Как это число пишется на иврите?':'Какое это число?'}</h1><div class="stimulus ${forward?'':'he'}" ${forward?'':'lang="he" dir="rtl"'}>${forward?q.n:text}</div>${!forward?'<div class="speech"><button class="sound" id="listen">▶ Послушать</button><p class="voice-status" id="voice-status" aria-live="polite"></p></div>':''}${method==='choice'?choiceHTML:inputHTML}<div id="feedback" aria-live="polite"></div><button class="hint" id="hint">Подсказка</button><p class="hinttext" id="hinttext" hidden></p>`;
 game.querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>answer(Number(b.dataset.number)));
 if(method==='input'){
  const field=$('#answer');field.value=q.draft;field.oninput=()=>{q.draft=field.value;$('#input-error').textContent='';};
  $('#answer-form').onsubmit=e=>{e.preventDefault();answer(field.value);};
  if(forward){$('#keyboard-toggle').onclick=()=>{const kb=$('#keyboard');kb.hidden=!kb.hidden;$('#keyboard-toggle').setAttribute('aria-expanded',String(!kb.hidden));};
   const kb=$('#keyboard');kb.innerHTML=[...'אבגדהוזחטיכלמנסעפצקרשתךםןףץ'].map(c=>`<button type="button" data-key="${c}" lang="he">${c}</button>`).join('')+'<button type="button" class="wide" data-key=" ">רווח · пробел</button><button type="button" class="wide" data-key="back">Удалить</button>';
   kb.querySelectorAll('[data-key]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{if(answered)return;const start=field.selectionStart??field.value.length,end=field.selectionEnd??start;const back=b.dataset.key==='back';field.setRangeText(back?'':b.dataset.key,back&&start===end?Math.max(0,start-1):start,end,'end');q.draft=field.value;field.focus({preventScroll:true});};});}
 }
 $('#hint').onclick=()=>{if(answered)return;q.hint=true;const h=$('#hinttext');h.hidden=false;if(forward){const parts=text.split(' ');h.textContent=q.n<=10?`Первая буква слова: ${text[0]}. Вспомни ${gender.value==='f'?'женскую':'мужскую'} форму.`:`Начни с «${parts[0]}». Порядок: сотни, десятки, единицы. Перед последней частью — ו («и»).`;}else{h.textContent=q.n<=10?`Это ${q.n%2?'нечётное':'чётное'} число из диапазона 1–10.`:q.n<100?`Число от ${Math.floor(q.n/10)*10} до ${Math.floor(q.n/10)*10+9}. Союз ו означает «и».`:`В числе ${Math.floor(q.n/100)} ${Math.floor(q.n/100)===1?'сотня':Math.floor(q.n/100)<5?'сотни':'сотен'}. Прочитай оставшуюся часть после сотен.`;}};
 if(!forward){$('#listen').onclick=()=>speak(q.n);refreshVoiceUI();}
}
function answer(value){
 if(answered||index>=10)return;
 const q=deck[index];let ok;
 if(method==='input'){
  const raw=String(value).trim();if(!raw){$('#input-error').textContent='Сначала введи ответ.';return;}
  if(direction==='reverse'&&!/^\d+$/.test(raw)){$('#input-error').textContent='Введи целое число цифрами, например 25.';return;}
  if(direction==='forward'&&!/[א-ת]/.test(raw)){$('#input-error').textContent='Напиши словами на иврите. Можно открыть клавиатуру ниже.';return;}
  ok=direction==='forward'?accepts(q.n,gender.value,raw):Number(raw)===q.n;
 }else{if(!q.choices.includes(value))return;ok=value===q.n;}
 answered=true;q.correct=ok;stop();
 if(ok){if(q.hint)helped++;else score++;}else errors.push(q.n);
 game.querySelectorAll('[data-number]').forEach(b=>{b.disabled=true;if(Number(b.dataset.number)===q.n)b.classList.add('correct');else if(Number(b.dataset.number)===value)b.classList.add('wrong');});
 if(method==='input'){$('#answer').readOnly=true;$('#answer').classList.add(ok?'correct':'wrong');$('#answer-form button').disabled=true;if($('#keyboard')){$('#keyboard').hidden=true;$('#keyboard-toggle').hidden=true;}}
 $('#stats').textContent=`Самостоятельно: ${score} · С подсказкой: ${helped} · Ошибки: ${errors.length}`;$('#hint').hidden=true;$('#hinttext').hidden=true;
 $('#feedback').innerHTML=`<div class="feedback ${ok?'good':'bad'}"><strong>${ok?(q.hint?'Верно, с подсказкой!':'Верно!'):'Запомним правильный ответ:'}</strong><div class="correct-answer">${q.n} = ${he(words(q.n,gender.value))}</div><button class="sound" id="listen">▶ Послушать ответ</button><p class="voice-status" id="voice-status" aria-live="polite"></p><div class="feedback-actions"><button class="primary" id="next">${index===9?'Результат':'Далее'}</button><button class="pause" id="pause">Пауза</button></div></div>`;
 // Remove the earlier playback controls so every ID remains unique.
 const old=game.querySelector('.speech');if(old)old.remove();
 $('#listen').onclick=()=>speak(q.n);refreshVoiceUI();$('#next').onclick=next;
 $('#pause').onclick=()=>{clearTimeout(timer);timer=null;$('#next').textContent=index===9?'Результат':'Далее';$('#pause').textContent='На паузе';$('#pause').disabled=true;};configureTimer();
}
function configureTimer(){clearTimeout(timer);timer=null;if(!answered||index>=10)return;const q=deck[index];$('#pause').hidden=!auto.checked;$('#pause').disabled=false;$('#pause').textContent='Пауза';$('#next').textContent=(index===9?'Результат':'Далее')+(auto.checked?` · ${q.correct?'1,5':'3'} с`:'');if(auto.checked)timer=setTimeout(next,q.correct?1500:3000);}
function next(){if(!answered)return;stop();index++;answered=false;render();}
function result(){const review=[...new Set([...errors,...deck.filter(q=>q.hint).map(q=>q.n)])];game.innerHTML=`<div class="result"><div class="medal">${score>=8?'✦':'123'}</div><h1>${score===10?'Все десять — самостоятельно!':'Раунд завершён'}</h1><div class="big">${score}<span style="font-size:20px"> / 10</span></div><div class="result-counts"><span>Самостоятельно: ${score}</span><span>С подсказкой: ${helped}</span><span>Ошибки: ${errors.length}</span></div><button class="primary" id="again">Ещё 10 вопросов</button>${review.length?`<div class="review"><b>Повтори эти числа</b>${review.map(n=>`<p><b>${n}</b>${he(words(n,gender.value))}</p>`).join('')}</div>`:''}</div>`;$('#again').onclick=begin;}
function findVoice(){if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){voice=null;return;}voice=window.speechSynthesis.getVoices().find(v=>/^(he|iw)(-|_|$)/i.test(v.lang))||null;}
function refreshVoiceUI(){const b=$('#listen'),s=$('#voice-status');if(!b||!s)return;b.disabled=!voice;s.textContent=voice?'':'Нет доступного голоса иврита. Добавь его в настройках синтеза речи устройства; поддержка зависит от браузера.';}
function speak(n){
 findVoice();refreshVoiceUI();if(!voice)return;
 // Listening after answering pauses the countdown, leaving time to hear and read.
 if(answered){clearTimeout(timer);timer=null;$('#next').textContent=index===9?'Результат':'Далее';$('#pause').textContent='На паузе';$('#pause').disabled=true;}
 speechId++;const call=speechId;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(words(n,gender.value,true));u.lang=voice.lang;u.voice=voice;u.rate=.85;
 u.onerror=()=>{if(call===speechId&&$('#voice-status'))$('#voice-status').textContent='Не удалось озвучить. Попробуй ещё раз или выбери другой браузер.';};window.speechSynthesis.speak(u);
}
document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{direction=b.dataset.direction;begin();});document.querySelectorAll('[data-method]').forEach(b=>b.onclick=()=>{method=b.dataset.method;begin();});level.onchange=begin;gender.onchange=begin;auto.onchange=configureTimer;
if(window.matchMedia('(min-width:761px)').matches)$('#settings').open=true;
findVoice();if('speechSynthesis'in window)window.speechSynthesis.addEventListener('voiceschanged',()=>{findVoice();refreshVoiceUI();});
window.addEventListener('pagehide',stop);begin();
