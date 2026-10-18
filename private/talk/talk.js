/* Guardian conversational preview. No model API, analytics, storage of audio, or site-side network requests.
   Auto-saves each completed text exchange as encrypted Markdown in the existing local Vault.
   Browser speech recognition is explicitly opt-in: the browser may use a remote STT provider.
   Speech synthesis uses platform voices; optional future Tortoise requires a separate service. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const {Vault} = window.GuardianVault;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let vault=null, memory=[], active=false, busy=false, recog=null, listening=false, speaking=false,
      speakReplies=false, consent=false, lastAnswer='', started=Date.now(), warnedSpeech=false;
  let timer=null, toastTimer=null, micError='';
  function micPolicyAllows(){const policy=document.permissionsPolicy || document.featurePolicy;return !policy || typeof policy.allowsFeature!=='function' || policy.allowsFeature('microphone');}

  function notice(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3900);}
  function status(text){$('voice-status').textContent=text;}
  function composeEnabled(enabled){$('chat-input').disabled=!enabled;$('chat-input').placeholder=enabled?"What's on your mind?":"Unlock your vault to start a conversation…";$('send').disabled=!enabled;const micReady=!!Recognition&&micPolicyAllows();$('mic').disabled=!enabled||!micReady;$('hear-again').disabled=!enabled||!('speechSynthesis' in window)||!lastAnswer;
    $('mic-helper').textContent=!enabled?'Unlock the vault to start talking.':!Recognition?'This browser does not support speech recognition; typing works everywhere.':!micReady?'Microphone is disabled by site permissions policy. Please reload after deployment.':'Tap the microphone to talk · Or type below';
    $('encryption-indicator').textContent=enabled?'🔒 Encrypted locally':'🔒 Locked';}
  function bubble(who,text,note){const row=document.createElement('div');row.className='msg '+who;const b=document.createElement('div');b.className='bubble';b.textContent=text;
    if(who==='assistant'){const avatar=document.createElement('div');avatar.className='msg-avatar';avatar.textContent='✳';row.append(avatar);}
    if(note){const n=document.createElement('small');n.textContent=note;b.append(n);}row.append(b);$('messages').append(row);$('messages').scrollTop=$('messages').scrollHeight;}
  function stopVoice(){if(recog&&listening){try{recog.abort();}catch{}}listening=false;$('companion');document.querySelector('.companion').classList.remove('is-listening','is-talking');if('speechSynthesis' in window){window.speechSynthesis.cancel();}speaking=false;}
  function lock(){stopVoice();if(vault)vault.lock();memory=[];active=false;busy=false;$('chat-input').value='';$('unlock-pass').value='';$('unlock-error').textContent='';$('unlock-overlay').hidden=false;composeEnabled(false);status('Here with you ✦');notice('Your conversation is locked.');}
  function chooseVoice(lang){const all=speechSynthesis.getVoices();return all.find(v=>v.lang?.toLowerCase()===lang?.toLowerCase()&&v.localService)||all.find(v=>v.lang?.split('-')[0]===lang?.split('-')[0]&&v.localService)||all.find(v=>v.lang?.toLowerCase()===lang?.toLowerCase())||all[0]||null;}
  function speak(text){if(!active||!('speechSynthesis' in window)){notice('No voice playback available in this browser.');return;}
    stopVoice();const utter=new SpeechSynthesisUtterance(text.slice(0,650));utter.lang=(navigator.language||'en-US').startsWith('pl')?'pl-PL':'en-US';utter.rate=.94;utter.pitch=1.07;
    const voice=chooseVoice(utter.lang);if(voice)utter.voice=voice;
    utter.onstart=()=>{speaking=true;document.querySelector('.companion').classList.add('is-talking');status('Speaking to you ✦');};
    const done=()=>{speaking=false;document.querySelector('.companion').classList.remove('is-talking');status('Here with you ✦');};utter.onend=done;utter.onerror=done;
    speechSynthesis.speak(utter);
  }
  function includes(text,...pieces){return pieces.some(p=>text.includes(p));}
  function respond(question){const q=question.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    const ordinary=memory.filter(x=>!x.title.startsWith('Conversation ·'));
    if(includes(q,'remember','pamiet','memories','wspomn','you know about me')){
      if(!ordinary.length)return 'There are no separate notes in your private vault yet. Our chats are being saved as encrypted Markdown, though. You can add a memory in My vault, and I can show you its title here.';
      const titles=ordinary.slice(-5).reverse().map(x=>'• '+x.title).join('\n');
      return `I can see ${ordinary.length} notes you chose to keep:\n${titles}\n\nFor now I can surface saved note titles, not deeply interpret them. You'll always control what stays in your vault.`;
    }
    if(includes(q,'plan my day','schedule','today','planuj','zaplan','dzien'))return 'Let’s make some room for today. ✨ Try picking one thing that matters most, one small task you can finish quickly, and one moment just for yourself. What’s your top priority?';
    if(includes(q,'study','learn','homework','uczyc','nauka','ucze','quiz'))return 'I’d love to help you learn. Try this: choose one topic, explain what you already know, and write one thing that confuses you. We can shape a study plan from there. (The full AI study tutor is coming later.)';
    if(includes(q,'hello','hey','hi','hej','czesc','witaj'))return 'Hey you! ☁️ Good to have you here. We can try planning a day, exploring saved memories, or simply testing this little conversation space.';
    if(includes(q,'thank','dziek'))return 'Anytime. I’m glad we’re building this little space together. ✨';
    if(includes(q,'who are you','what can you do','co potraf','kim jestes'))return 'I’m the Guardian conversation preview. Right now I can speak with your device’s voice, help you try a few planning prompts, and encrypt our text exchanges on your device. A real language model is not connected yet.';
    return 'I hear you. ☁️ This is our first local conversation preview, so I can’t reason through an open-ended question yet. Our exchange has been encrypted on your device. Try asking me to plan your day, explore your memories, or start studying.';
  }
  async function savePair(question,answer){if(!active||!vault?.key)throw new Error('Vault locked');const content=`## You\n\n${question}\n\n## Guardian · local preview\n\n${answer}\n`;
    const record={id:crypto.randomUUID(),title:'Conversation · '+question.replace(/\s+/g,' ').slice(0,52),content,category:'life',createdAt:new Date().toISOString(),source:null};
    await vault.save(record);memory.push(record);
  }
  async function send(text){if(!active||busy||!vault?.key)return;const question=text.trim().slice(0,1500);if(!question)return;
    busy=true;const input=$('chat-input');input.value='';input.focus();$('send').disabled=true;status('Thinking of a reply ✦');bubble('user',question);
    const answer=respond(question);lastAnswer=answer;try{await savePair(question,answer);bubble('assistant',answer,'Encrypted Markdown · local response');status('Saved securely ✦');if(speakReplies)speak(answer);}catch(error){bubble('assistant',answer,'Preview reply · NOT SAVED');notice('Could not encrypt this exchange — check device storage.');status('Not saved');console.warn(error.name);}
    busy=false;$('send').disabled=false;$('hear-again').disabled=!('speechSynthesis' in window)||!lastAnswer;
  }
  function startSpeech(){
    if(!active||!Recognition||listening)return;
    if(!micPolicyAllows()){status('Microphone restricted');$('mic-helper').textContent='The site’s microphone policy blocks recognition. Refresh after the Cloudflare update.';return;}
    micError='';stopVoice();try{recog=new Recognition();recog.lang=navigator.language||'en-US';recog.continuous=false;recog.interimResults=true;recog.maxAlternatives=1;
      recog.onstart=()=>{micError='';listening=true;document.querySelector('.companion').classList.add('is-listening');status('I’m listening…');$('mic-helper').textContent='Say something · Tap the microphone again to stop';};
      recog.onresult=e=>{let heard='';let final=false;for(let i=e.resultIndex;i<e.results.length;i++){heard+=e.results[i][0].transcript;final=final||e.results[i].isFinal;}
        $('chat-input').value=heard;if(final){recog.stop();send(heard);}};
      recog.onerror=e=>{
        const reasons={
          'not-allowed':'Voice input was denied. Check both the browser site permission and your device microphone privacy settings.',
          'service-not-allowed':'The browser speech-recognition service is unavailable or restricted. Try Chrome or use typing.',
          'audio-capture':'The browser cannot access a working microphone. Check your audio input device.',
          'network':'The browser speech service could not connect. Your message can still be typed.',
          'no-speech':'I didn’t hear anything. Tap the microphone and try again.',
          'aborted':'Voice input stopped.'
        };
        micError=reasons[e.error]||('Speech recognition issue: '+(e.error||'unknown'));
        if(e.error!=='aborted'){notice(micError);status('Voice input unavailable');$('mic-helper').textContent=micError;}
      };
      recog.onend=()=>{listening=false;document.querySelector('.companion').classList.remove('is-listening');if(active && !micError){status('Here with you ✦');$('mic-helper').textContent='Tap the microphone to talk · Or type below';}};
      recog.start();
    }catch{notice('Unable to start browser speech recognition.');}}
  async function init(){
    if(!window.GuardianVault){$('unlock-error').textContent='Vault encryption module could not load.';return;}
    if((location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname))||location.hostname.endsWith('.github.io')){$('unlock-error').textContent='This preview requires a dedicated HTTPS origin.';return;}
    try{vault=await Vault.load();const created=await vault.isCreated();if(!created){$('unlock-title').textContent='Your vault comes first.';$('unlock-desc').textContent='Create an encrypted vault first. Then return here with your passphrase.';$('unlock-pass').disabled=true;$('unlock-submit').disabled=true;}}catch(e){$('unlock-error').textContent='Secure storage is unavailable in this browser.';return;}
    composeEnabled(false);
    $('unlock-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('unlock-submit');button.disabled=true;$('unlock-error').textContent='';try{await vault.unlock($('unlock-pass').value);memory=await vault.list();active=true;started=Date.now();$('unlock-overlay').hidden=true;$('unlock-pass').value='';composeEnabled(true);status('Here with you ✦');notice('Unlocked. Our exchanges will be encrypted locally.');$('chat-input').focus();navigator.storage?.persist?.().catch(()=>{});}catch(error){vault.lock();$('unlock-error').textContent='Incorrect passphrase or damaged vault.';}finally{button.disabled=false;}});
    $('chat-form').addEventListener('submit',e=>{e.preventDefault();send($('chat-input').value);});
    $('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send($('chat-input').value);}});
    document.querySelectorAll('[data-text]').forEach(b=>b.addEventListener('click',()=>{if(active)send(b.dataset.text);}));
    $('clear-view').addEventListener('click',()=>{const rows=$('messages').querySelectorAll('.msg');rows.forEach(r=>r.remove());notice('Chat cleared from view. Encrypted records remain in My vault.');});
    $('mute').addEventListener('click',()=>{speakReplies=!speakReplies;$('mute').classList.toggle('active',speakReplies);$('mute').setAttribute('aria-pressed',String(speakReplies));$('mute').setAttribute('aria-label',speakReplies?'Turn off spoken replies':'Turn on spoken replies');notice(speakReplies?'Spoken replies enabled.':'Spoken replies disabled.');if(!speakReplies)stopVoice();});
    $('hear-again').addEventListener('click',()=>speak(lastAnswer));
    $('mic').addEventListener('click',()=>{if(!Recognition||!active)return;if(listening){recog?.stop();return;}if(!consent){$('mic-dialog').hidden=false;return;}startSpeech();});
    $('mic-cancel').addEventListener('click',()=>{$('mic-dialog').hidden=true;});
    $('mic-accept').addEventListener('click',()=>{consent=true;$('mic-dialog').hidden=true;startSpeech();});
    // Exactly the same pupil positions and blink behavior as Guardian’s landing-page face.
    const face=$('talk-guardian-face');let gazeX=0,gazeY=0;
    document.addEventListener('pointermove',e=>{
      const r=face.getBoundingClientRect();
      const dx=(e.clientX-r.left-r.width/2)/(innerWidth||1);
      const dy=(e.clientY-r.top-r.height/2)/(innerHeight||1);
      gazeX=Math.max(-3.8,Math.min(3.8,dx*12));
      gazeY=Math.max(-2.8,Math.min(2.8,dy*10));
      face.querySelectorAll('.pupil').forEach(p=>{
        p.style.setProperty('--eye-x',gazeX.toFixed(2)+'px');
        p.style.setProperty('--eye-y',gazeY.toFixed(2)+'px');
      });
      face.style.setProperty('--face-tilt',(gazeX*.65).toFixed(2)+'deg');
    },{passive:true});
    function blink(){
      if(!document.hidden){
        face.classList.add('blinking');
        setTimeout(()=>face.classList.remove('blinking'),270);
      }
      setTimeout(blink,2700+Math.random()*3500);
    }
    setTimeout(blink,1700);
    window.addEventListener('blur',()=>{
      face.style.setProperty('--face-tilt','0deg');
      face.querySelectorAll('.pupil').forEach(p=>{p.style.setProperty('--eye-x','0px');p.style.setProperty('--eye-y','0px');});
    });
    const refreshActivity=()=>{started=Date.now();};document.addEventListener('pointerdown',refreshActivity,{passive:true});document.addEventListener('keydown',refreshActivity,{passive:true});
    timer=setInterval(()=>{if(active&&Date.now()-started>10*60_000)lock();},16000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();}});
    window.addEventListener('pagehide',()=>{stopVoice();vault?.lock();});
  }
  init();
})();
