const V='mp-v10';
const SHELL=['./','./index.html','./engine.js','./shopping.js','./sync.js','./recipes-ui.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(V);
  // cache individually — one bad file must not abort the whole install
  await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));
  self.skipWaiting();
})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const ks=await caches.keys();
  await Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)));
  await self.clients.claim();
})());});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.pathname.includes('/.netlify/'))return;
  // network-first for the data and the shell, so a stale cache can never mask a good deploy
  const fresh=/recipes\.json$|index\.html$|\/$|(?:engine|shopping|sync|recipes-ui)\.js$/.test(u.pathname);
  e.respondWith((async()=>{
    const c=await caches.open(V);
    if(fresh){
      try{const r=await fetch(e.request,{cache:'no-store'});
        if(r.ok&&u.origin===location.origin)c.put(e.request,r.clone());
        return r;}catch(err){const hit=await c.match(e.request);
        if(hit)return hit; throw err;}
    }
    const hit=await c.match(e.request); if(hit)return hit;
    const r=await fetch(e.request);
    if(r.ok&&u.origin===location.origin)c.put(e.request,r.clone());
    return r;
  })());
});
