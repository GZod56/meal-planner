/* Household sync keeps local edits until a version-checked cloud write succeeds. */
window.Household=(()=>{
 let adapter=null,busy=false,signedIn=false,configured=false,conflicts=[],timer=null;
 const endpoint='/.netlify/functions/';
 const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
 const meta=parse('mp.syncMeta',{versions:{},pending:{}});
 meta.versions||={};meta.pending||={};
 const save=()=>localStorage.setItem('mp.syncMeta',JSON.stringify(meta));
 const allowed=k=>/^(mp\.(plan|history|deletedRecipes|recipes)|mp\.(sides|prep|shop)::.+|photo::.+)$/.test(k);
 let status='Connect household';
 const notify=()=>document.querySelectorAll('[data-sync-status]').forEach(el=>el.textContent=status);
 const state=s=>{status=s;notify();};
 async function api(path,options={}){
   const res=await fetch(endpoint+path,{...options,credentials:'same-origin',headers:{'content-type':'application/json',...options.headers}});
   const body=await res.json().catch(()=>({error:res.status===429?'Too many requests. Wait a minute and try again.':'Could not connect.'}));
   if(!res.ok){const error=new Error(body.error||'Could not connect.');error.status=res.status;throw error;}return body;
 }
 function track(key){
   if(!allowed(key))return;
   meta.pending[key]=(meta.pending[key]||0)+1;save();
   state(signedIn?'Changes waiting to sync':'Saved on this device');
   clearTimeout(timer);timer=setTimeout(sync,800);
 }
 async function pull(key,etag){
   const item=await api('sync?key='+encodeURIComponent(key));
   await adapter.set(key,item.value);meta.versions[key]=item.etag||etag;save();
 }
 async function sync(){
   if(!adapter||!signedIn||busy||!navigator.onLine||adapter.canSync?.()===false)return;
   busy=true;conflicts=[];let refreshed=false;
   try{
     state('Syncing…');
     const {items}=await api('sync');
     const remote=new Map(items.map(i=>[i.key,i.etag]));
     for(const key of Object.keys(meta.versions)){
       if(!remote.has(key)){meta.versions[key]=null;meta.pending[key]||=1;}
     }
     for(const [key,etag]of remote){
       if(meta.pending[key]){
         if((meta.versions[key]||null)!==etag){
           const cloud=await api('sync?key='+encodeURIComponent(key));
           if(JSON.stringify(await adapter.get(key))===JSON.stringify(cloud.value)){delete meta.pending[key];meta.versions[key]=cloud.etag;save();}
           else conflicts.push({key,etag:cloud.etag,value:cloud.value});
         }
       }else if(meta.versions[key]!==etag){await pull(key,etag);refreshed=true;}
     }
     for(const key of Object.keys(meta.pending)){
       if(conflicts.some(c=>c.key===key))continue;
       const generation=meta.pending[key],value=await adapter.get(key);
       try{
         const result=await api('sync?key='+encodeURIComponent(key),{method:'PUT',body:JSON.stringify({value,etag:meta.versions[key]||null})});
         meta.versions[key]=result.etag;if(meta.pending[key]===generation)delete meta.pending[key];save();
       }catch(e){if(e.status!==409)throw e;const cloud=await api('sync?key='+encodeURIComponent(key));conflicts.push({key,etag:cloud.etag,value:cloud.value});}
     }
     if(refreshed)adapter.refresh();
     state(conflicts.length?'Review sync conflicts':Object.keys(meta.pending).length?'Changes waiting to sync':'Synced');
   }catch(e){
     if(e.status===401){signedIn=false;state('Sign in to sync');}
     else state('Offline or unavailable · local copy kept');
   }finally{busy=false;notify();}
 }
 async function start(a){
   adapter=a;
   for(const key of await adapter.keys())if(allowed(key)&&!meta.versions[key]&&!meta.pending[key]){meta.pending[key]=1;}
   save();
   try{const session=await api('session');signedIn=session.signedIn;configured=session.configured;state(signedIn?'Syncing…':'Connect household');if(signedIn)await sync();}
   catch{state('Saved on this device');}
   setInterval(sync,30000);
   window.addEventListener('online',sync);
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();});
 }
 function open(){
   const sh=document.querySelector('#sheet');sh.classList.add('open');
   const escape=adapter.escape;
   sh.innerHTML=`<div class="sheet-inner"><h2 class="rname">Household</h2>
     <p class="sheet-note">Use the same household password on each device to share recipes, deletions, plans, checkmarks, and photos. Assistant chat stays on this device.</p>
     <p role="status" data-sync-status>${escape(status)}</p>
     ${signedIn?`<div class="save-row"><button data-sync-now>Sync now</button><button data-signout>Sign out</button></div>`:
     '<form id="householdLogin"><div class="field"><label for="householdPassword">Household password</label><input id="householdPassword" type="password" autocomplete="current-password" required minlength="16"></div><div class="save-row"><button class="primary" type="submit">Connect household</button></div></form>'}
     ${conflicts.length?`<p>Some items changed on both devices: ${conflicts.map(c=>escape(c.key.replace('mp.','').replace('photo::','Photo: '))).join(', ')}.</p><div class="save-row"><button data-resolve="local">Keep this device’s versions</button><button data-resolve="cloud">Use synced versions</button></div>`:''}
     <p id="syncError" role="alert"></p><button class="sheet-btn" data-sync-close>Done</button>
     </div>`;
   const form=sh.querySelector('form');
   if(form)form.onsubmit=async e=>{
     e.preventDefault();const button=form.querySelector('button');button.disabled=true;
     try{await api('session',{method:'POST',body:JSON.stringify({password:form.querySelector('input').value})});signedIn=true;await sync();open();}
     catch(err){sh.querySelector('#syncError').textContent=err.message;button.disabled=false;}
   };
   sh.onclick=async e=>{
     if(e.target===sh||e.target.closest('[data-sync-close]')){sh.classList.remove('open');adapter.refresh();return;}
     if(e.target.closest('[data-sync-now]')){await sync();open();}
     if(e.target.closest('[data-signout]')){
       try{await api('session',{method:'DELETE'});signedIn=false;state('Saved on this device');open();}catch(err){sh.querySelector('#syncError').textContent=err.message;}
     }
     const resolve=e.target.closest('[data-resolve]');
     if(resolve){try{
       for(const c of conflicts){meta.versions[c.key]=c.etag;if(resolve.dataset.resolve==='cloud'){await adapter.set(c.key,c.value);delete meta.pending[c.key];}}
       save();conflicts=[];adapter.refresh();await sync();open();
     }catch(err){sh.querySelector('#syncError').textContent='Could not save the selected versions. Your local copies are kept.';}}
   };
 }
 return {start,track,sync,open,status:()=>status,signedIn:()=>signedIn,api};
})();
