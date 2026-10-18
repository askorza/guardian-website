/* Guardian Private Vault beta: no network requests, cookies or tracking. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const enc = new TextEncoder();
  const {Vault,markdown,categoryNames} = window.GuardianVault;
  let vault=null, notes=[], selectedFile=null, created=false, timeout=null, lastActive=Date.now(),toastTimer=0;
  const notice = (msg,bad=false) => {
    const t=$('toast'); t.textContent=msg;t.className='toast is-visible'+(bad?' is-error':'');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className='toast',4600);
  };
  function download(name,contents,type){const blob=new Blob([contents],{type});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),7000);}
  function labelDate(stamp){const d=new Date(stamp);return Number.isNaN(d.valueOf())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
  function showAccess(){
    $('access-panel').hidden=false;$('unlocked-content').hidden=true;
    $('access-title').textContent=created?'Unlock your private vault.':'Create your private vault.';
    $('access-description').textContent=created?'Enter your passphrase to decrypt memories in this browser. Nothing is sent to a server.':'Create a strong, memorable passphrase. Guardian never stores or sends it, and it cannot be recovered if you lose it.';
    $('confirm-row').hidden=created;
    $('vault-confirm').required=!created;
    $('vault-pass').setAttribute('autocomplete',created?'current-password':'new-password');
    $('access-submit').innerHTML=created?'Unlock vault <span>↗</span>':'Create encrypted vault <span>↗</span>';
    $('restore-file').disabled=created;
    $('access-tools').hidden=created;
    $('access-error').textContent='';$('access-form').reset();
  }
  async function reload(){notes=await vault.list();render();}
  function render(){
    const kind=$('filter-category').value;
    const visible=notes.filter(n=>kind==='all'||n.category===kind).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('memory-count').textContent=`${visible.length} / ${notes.length} memories`;
    $('storage-kind').textContent=vault.store.kind;
    const list=$('memory-list');list.replaceChildren();
    if(!visible.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent=notes.length?'No memories in this category.':'No memories yet. Add a thought to your encrypted vault.';list.append(empty);return;}
    for(const n of visible){
      const item=document.createElement('article');item.className='memory-item';
      const top=document.createElement('div');top.className='memory-top';
      const cat=document.createElement('span');cat.textContent=categoryNames[n.category];
      const date=document.createElement('span');date.textContent=labelDate(n.createdAt);top.append(cat,date);
      const title=document.createElement('h3');title.textContent=n.title;
      const excerpt=document.createElement('p');excerpt.textContent=n.content.slice(0,205)+(n.content.length>205?'…':'')||(n.source?`File reference: ${n.source.name}`:'');
      const info=document.createElement('div');info.className='memory-meta';
      const size=document.createElement('span');size.textContent=`${enc.encode(markdown(n)).length} bytes · encrypted Markdown`;
      const actions=document.createElement('div');
      const exportNote=document.createElement('button');exportNote.type='button';exportNote.textContent='Export .md';
      exportNote.addEventListener('click',()=>{if(!confirm('This creates an UNENCRYPTED Markdown file in your downloads. Continue?'))return;download(`guardian-memory-${n.id.slice(0,8)}.md`,markdown(n),'text/markdown;charset=utf-8');notice('Readable Markdown file exported. Keep it private.');});
      const del=document.createElement('button');del.type='button';del.textContent='Forget';
      del.addEventListener('click',async()=>{if(!confirm(`Forget “${n.title}” in this local vault? Previous backups will not change.`))return;try{await vault.remove(n.id);await reload();notice('Encrypted memory deleted.');}catch{notice('Unable to delete memory.',true);}});
      actions.append(exportNote,del);info.append(size,actions);item.append(top,title,excerpt,info);list.append(item);
    }
  }
  function unlocked(){
    $('access-panel').hidden=true;$('unlocked-content').hidden=false;
    $('vault-pass').value='';$('vault-confirm').value='';lastActive=Date.now();
  }
  function lock(){if(!vault)return;vault.lock();notes=[];selectedFile=null;$('note-form').reset();$('source-note').textContent='No file selected.';showAccess();notice('Vault locked. Your passphrase is required to open it again.');}
  async function fileHash(file){
    if(file.size>12*1024*1024)return 'not-computed-large-file';
    const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function updateActivity(){lastActive=Date.now();}
  async function init(){
    if(location.protocol!=='https:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1') {
      $('access-error').textContent='This encrypted vault requires HTTPS.';
      $('access-submit').disabled=true;return;
    }
    if(location.hostname.endsWith('.github.io')) {
      $('access-error').textContent='The vault is disabled on shared GitHub Pages. Open its dedicated Cloudflare Pages site.';
      $('access-submit').disabled=true;return;
    }
    if(!crypto?.subtle||!crypto?.randomUUID){$('access-error').textContent='Web Crypto is not available in this browser.';$('access-submit').disabled=true;return;}
    try{vault=await Vault.load();created=await vault.isCreated();showAccess();}
    catch(err){$('access-error').textContent='Secure local storage is unavailable. Please use a regular browser window.';$('access-submit').disabled=true;console.warn(err.name);return;}
    $('access-form').addEventListener('submit',async e=>{
      e.preventDefault();const pass=$('vault-pass').value,button=$('access-submit');button.disabled=true;$('access-error').textContent='';
      try{
        if(created)await vault.unlock(pass);
        else {if(pass!==$('vault-confirm').value)throw new Error('Passphrases do not match');await vault.create(pass);created=true;}
        unlocked();await reload();notice('Encrypted vault unlocked.');
        navigator.storage?.persist?.().catch(()=>{});
      }catch(err){$('access-error').textContent=err.message||'Unable to unlock the vault.';}
      finally{button.disabled=false;}
    });
    $('restore-file').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{if(file.size>15*1024*1024)throw new Error('Backup exceeds the 15 MB import limit');await vault.restore(await file.text());created=true;showAccess();notice('Encrypted backup imported. Enter its original passphrase.');}
      catch(err){$('access-error').textContent=err.message||'Backup import failed.';}
      e.target.value='';
    });
    $('note-form').addEventListener('submit',async e=>{
      e.preventDefault();const title=$('note-title').value.trim(),content=$('note-content').value.trim();
      if(!title||(!content&&!selectedFile)){notice('Write a note or reference a file.',true);return;}
      const button=$('save-memory');button.disabled=true;
      try{const file=selectedFile;const source=file?{name:file.name.slice(0,180),size:file.size,hash:await fileHash(file)}:null;
        await vault.save({id:crypto.randomUUID(),title,content,category:$('note-category').value,createdAt:new Date().toISOString(),source});
        selectedFile=null;$('note-form').reset();$('source-note').textContent='No file selected.';await reload();notice('Markdown encrypted and saved on your device.');
      }catch(err){console.warn('Vault write failed',err.name);notice('Saving failed. Please check device storage.',true);}finally{button.disabled=false;}
    });
    $('reference-file').addEventListener('change',e=>{selectedFile=e.target.files?.[0]||null;$('source-note').textContent=selectedFile?`${selectedFile.name} · ${(selectedFile.size/1024).toFixed(1)} KB · reference only`:'No file selected.';});
    $('filter-category').addEventListener('change',render);
    $('backup').addEventListener('click',async()=>{try{const data=await vault.backup();download(`guardian-encrypted-backup-${new Date().toISOString().slice(0,10)}.guardian.json`,data,'application/json');notice('Encrypted recovery backup downloaded. Keep your passphrase safe.');}catch{notice('Unable to create backup.',true);}});
    $('export-all').addEventListener('click',()=>{
      if(!notes.length){notice('No memories to export.',true);return;}
      if(!confirm('This creates an UNENCRYPTED .md file containing all visible memory contents. Anyone with the file can read it. Continue?'))return;
      const text=['# Guardian memory export','',`Exported: ${new Date().toISOString()}`,'',...notes.map(n=>markdown(n)+'\n')].join('\n---\n\n');
      download('guardian-readable-memories.md',text,'text/markdown;charset=utf-8');notice('Unencrypted Markdown exported. Store it safely.');
    });
    $('lock').addEventListener('click',lock);
    $('forget-category').addEventListener('click',async()=>{
      const c=$('filter-category').value;if(c==='all'){notice('Select a category to forget.',true);return;}
      const targets=notes.filter(n=>n.category===c);if(!targets.length){notice('No memories in that category.');return;}
      if(!confirm(`Delete ${targets.length} ${categoryNames[c]} memories? Previously downloaded backups remain unchanged.`))return;
      try{for(const n of targets)await vault.remove(n.id);await reload();notice('Selected memories deleted.');}catch{notice('Some memories could not be deleted.',true);}
    });
    $('clear-all').addEventListener('click',async()=>{
      if(!notes.length){notice('Vault is already empty.');return;}
      if(!confirm(`Permanently remove all ${notes.length} records from this vault? Existing backups are not deleted.`))return;
      try{for(const n of [...notes])await vault.remove(n.id);await reload();notice('Vault memory records removed.');}catch{notice('Some memories could not be deleted.',true);}
    });
    ['pointerdown','keydown'].forEach(type=>window.addEventListener(type,updateActivity,{passive:true}));
    timeout=setInterval(()=>{if(vault?.key && (Date.now()-lastActive)>10*60_000)lock();},15000);
  }
  init();
})();
