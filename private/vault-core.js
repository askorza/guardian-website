/* Guardian Private Vault: self-contained Web Crypto + encrypted OPFS/IndexedDB storage.
   No dependencies, telemetry, network calls or third-party scripts.
   Security review needed before production use. */
(() => {
  'use strict';
  const te = new TextEncoder();
  const td = new TextDecoder();
  const ITERATIONS = 400_000;
  const VERSION = 1;
  const DIR = 'guardian-private-v1';
  const DB = 'guardian-private-v1';
  const CHECK = 'guardian-private-vault-verification-v1';
  const categoryNames = Object.freeze({ work:'Work & projects', study:'Study & learning', life:'Daily life', preferences:'Preferences' });
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const safeId = id => { if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid memory ID'); return id; };
  const random = n => crypto.getRandomValues(new Uint8Array(n));

  function markdown(note) {
    const cleaned = value => JSON.stringify(String(value ?? '').slice(0, 160));
    const lines = [ '---', `id: ${cleaned(note.id)}`, `title: ${cleaned(note.title)}`,
      `category: ${cleaned(note.category)}`, `created_at: ${cleaned(note.createdAt)}` ];
    if (note.source) {
      lines.push(`source_name: ${cleaned(note.source.name)}`, `source_size_bytes: ${Number(note.source.size)||0}`,
        `source_sha256: ${cleaned(note.source.hash||'not-computed')}`);
    }
    lines.push('---','','# '+String(note.title).replace(/[\r\n]/g, ' ').slice(0, 160),'',String(note.content||''),'');
    return lines.join('\n');
  }
  function parseMarkdown(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('---\n')) throw new Error('Invalid Markdown record');
    const end = raw.indexOf('\n---\n', 4);
    if (end < 0) throw new Error('Missing Markdown metadata');
    const meta = {};
    for (const line of raw.slice(4, end).split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const k = line.slice(0,i).trim(), value = line.slice(i+1).trim();
      if (!/^[a-z_]+$/.test(k)) continue;
      try { meta[k] = JSON.parse(value); } catch { meta[k] = value; }
    }
    if (!meta.id || !categoryNames[meta.category]) throw new Error('Unexpected record schema');
    safeId(meta.id);
    const body = raw.slice(end+5).replace(/^\n?# [^\n]*\n\n/, '').replace(/\n$/, '');
    return {
      id: meta.id, title: String(meta.title||'Untitled'), category: meta.category,
      createdAt: String(meta.created_at||''), content: body,
      source: meta.source_name ? {name:String(meta.source_name), size:Number(meta.source_size_bytes)||0, hash:String(meta.source_sha256||'')} : null
    };
  }

  async function derive(password, salt, iterations=ITERATIONS) {
    const input = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'}, input,
      {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  }
  async function seal(key,id,plain) {
    const iv=random(12);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:te.encode(`guardian-v1:${id}`)},key,te.encode(plain));
    return {v:VERSION,id,iv:b64(iv),data:b64(encrypted)};
  }
  async function open(key, entry) {
    if (!entry || entry.v !== VERSION || typeof entry.id!=='string' || typeof entry.iv!=='string' || typeof entry.data!=='string') throw new Error('Unsupported encrypted record');
    return td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(entry.iv),additionalData:te.encode(`guardian-v1:${entry.id}`)},key,un64(entry.data)));
  }

  async function createStore() {
    if (navigator.storage?.getDirectory) {
      try {
        const origin=await navigator.storage.getDirectory();
        const dir=await origin.getDirectoryHandle(DIR,{create:true});
        const readJson=async name => {
          try {const file=await dir.getFileHandle(name);return JSON.parse(await (await file.getFile()).text());}
          catch(e){if(e.name==='NotFoundError')return null;throw e;}
        };
        const writeJson=async(name,obj)=>{const file=await dir.getFileHandle(name,{create:true});const writer=await file.createWritable();await writer.write(JSON.stringify(obj));await writer.close();};
        return {
          kind:'Encrypted OPFS files',
          readMeta:()=>readJson('vault-info.json'),
          writeMeta:m=>writeJson('vault-info.json',m),
          readAll:async()=>{const records=[];for await(const[name,handle]of dir.entries())if(name.endsWith('.md.enc')&&handle.kind==='file'){const item=await readJson(name);if(item) records.push(item);}return records;},
          save:r=>writeJson(safeId(r.id)+'.md.enc',r),
          remove:async id=>{try{await dir.removeEntry(safeId(id)+'.md.enc');}catch(e){if(e.name!=='NotFoundError')throw e;}}
        };
      } catch(e){console.warn('OPFS unavailable; trying encrypted IndexedDB',e.name);}
    }
    if (!('indexedDB' in window)) throw new Error('Device storage is not supported');
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{req.result.createObjectStore('meta');req.result.createObjectStore('records',{keyPath:'id'});};
      req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
    });
    const query=(table,mode,method,arg,key)=>new Promise((resolve,reject)=>{
      const tx=db.transaction(table,mode);const req=tx.objectStore(table)[method](...(key===undefined?[arg]:[arg,key]));
      let val;req.onsuccess=()=>val=req.result;tx.oncomplete=()=>resolve(val);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    return {
      kind:'Encrypted IndexedDB',
      readMeta:()=>query('meta','readonly','get','vault'),
      writeMeta:m=>query('meta','readwrite','put',m,'vault'),
      readAll:()=>query('records','readonly','getAll',undefined),
      save:r=>query('records','readwrite','put',r),
      remove:id=>query('records','readwrite','delete',safeId(id))
    };
  }

  class Vault {
    constructor(store){this.store=store;this.key=null;this.meta=null;}
    static async load(){return new Vault(await createStore());}
    async isCreated(){this.meta=await this.store.readMeta();return !!this.meta;}
    async create(pass){
      if ((await this.isCreated()))throw new Error('A vault already exists on this device');
      if (pass.length<12||pass.length>256)throw new Error('Use a passphrase of 12–256 characters');
      const salt=random(16),key=await derive(pass,salt);
      const check=await seal(key,'__check__',CHECK);
      const meta={v:VERSION,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt),check};
      await this.store.writeMeta(meta);this.meta=meta;this.key=key;
    }
    async unlock(pass){
      const meta=this.meta||await this.store.readMeta();
      if (!meta||meta.v!==VERSION||meta.kdf!=='PBKDF2-SHA256'||meta.iterations<300000||meta.iterations>2000000)throw new Error('Unsupported vault format');
      const key=await derive(pass,un64(meta.salt),meta.iterations);
      try{if(await open(key,meta.check)!==CHECK)throw new Error('Incorrect passphrase');}catch{throw new Error('Incorrect passphrase or damaged vault');}
      this.meta=meta;this.key=key;
    }
    lock(){this.key=null;}
    requireKey(){if(!this.key)throw new Error('Unlock your vault first');return this.key;}
    async list(){const key=this.requireKey();const rows=await this.store.readAll();const notes=[];for(const row of rows){const plain=await open(key,row);const n=parseMarkdown(plain);if(n.id!==row.id)throw new Error('Mismatched encrypted record');notes.push(n);}return notes;}
    async save(note){this.requireKey();safeId(note.id);if(!categoryNames[note.category])throw new Error('Unknown category');const encrypted=await seal(this.key,note.id,markdown(note));await this.store.save(encrypted);}
    async remove(id){this.requireKey();await this.store.remove(id);}
    async backup(){const meta=await this.store.readMeta();const records=await this.store.readAll();if(!meta)throw new Error('No vault exists');return JSON.stringify({type:'guardian-encrypted-backup',version:VERSION,exportedAt:new Date().toISOString(),meta,records});}
    async restore(raw){
      if(await this.isCreated())throw new Error('Import requires an empty vault on this browser profile');
      const obj=JSON.parse(raw);
      if(obj.type!=='guardian-encrypted-backup'||obj.version!==VERSION||!obj.meta||!Array.isArray(obj.records)||obj.records.length>5000)throw new Error('Not a supported encrypted backup');
      if(obj.meta.v!==VERSION||obj.meta.kdf!=='PBKDF2-SHA256'||typeof obj.meta.salt!=='string'||typeof obj.meta.check?.data!=='string')throw new Error('Damaged backup metadata');
      for(const rec of obj.records){safeId(rec.id);if(rec.v!==VERSION||typeof rec.data!=='string'||typeof rec.iv!=='string'||rec.data.length>1_000_000||!/^[-A-Za-z0-9+/=]+$/.test(rec.data))throw new Error('Invalid backup record');}
      for(const rec of obj.records)await this.store.save(rec);
      await this.store.writeMeta(obj.meta);this.meta=obj.meta;
    }
  }
  window.GuardianVault = Object.freeze({Vault,markdown,parseMarkdown,categoryNames});
})();
