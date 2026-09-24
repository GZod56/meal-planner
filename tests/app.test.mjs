import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {token,authenticated,authorize} from '../server/security.mjs';
import session from '../netlify/functions/session.mjs';
import {makeHandler,allowedKey} from '../netlify/functions/sync.mjs';
import chat,{config as chatConfig} from '../netlify/functions/chat.mjs';
import {publicIP,extractRecipe,readPublicPage} from '../server/import-recipe.mjs';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const context=vm.createContext({window:{},URL,crypto:globalThis.crypto});
vm.runInContext(source('shopping.js'),context);
vm.runInContext(source('recipes-ui.js'),context);
const shopping=context.window.Shopping;
process.env.APP_PASSWORD='test-only-household-password';
const request=(path,method='GET',body,auth=true)=>new Request('https://meal.example/'+path,{method,headers:{...(auth?{cookie:'mp_session='+token()}:{}),'origin':'https://meal.example'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
test('all frontend scripts parse and pregnancy references are removed',()=>{
 for(const file of ['index.html','engine.js','shopping.js','sync.js','recipes-ui.js','sw.js']){
   const js=file.endsWith('.html')?source(file).match(/<script>\s*([\s\S]*?)<\/script>/)[1]:source(file);
   new vm.Script(js);
 }
 assert.doesNotMatch(source('index.html')+source('recipes.json'),/pregnan|postpartum|breastfeed/i);
 assert.ok(JSON.parse(source('recipes.json')).length>=200);
});
test('recipe serving scaler keeps equivalent measures and package sizes consistent',()=>{
 const html=source('index.html');
 const block=html.slice(html.indexOf('const FR='),html.indexOf('function slotByKey'));
 const qctx=vm.createContext({esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')});
 vm.runInContext(block,qctx);
 assert.equal(qctx.scaleIng('750g/ 25 oz pinot noir',2),'<span class="qty">1500</span>g/ <span class="qty">50</span> oz pinot noir');
 assert.equal(qctx.scaleIng('2 cans (15 oz) beans',2),'<span class="qty">4</span> cans (15 oz) beans');
 assert.equal(qctx.scaleIng('1 cup (240 ml) milk',2),'<span class="qty">2</span> cup (<span class="qty">480</span> ml) milk');
 assert.equal(qctx.scaleIng('Soy Sauce 3 Tbsp',2),'Soy Sauce <span class="qty">6</span> Tbsp');
 assert.equal(qctx.scaleIng('250 – 300 g/8 – 10 oz pork mince',2),'<span class="qty">500–600</span> g/<span class="qty">16–20</span> oz pork mince');
});
test('shopping combines compatible volume and count units, respects batch scale',()=>{
 const recipes=[{id:'a',name:'A',ingredients:['1 tablespoon olive oil','1 onion','1/2 cup rice']},{id:'b',name:'B',ingredients:['3 teaspoons olive oil','2 onions, chopped','120 ml rice']}];
 const result=shopping.build({batch:{recipeId:'a'},dinners:[{recipeId:'b'}]},recipes,{batchScale:3});
 const all=Object.values(result).flat();
 assert.equal(all.find(x=>x.key==='olive oil|ml|measured').label,'Olive oil — 4 tbsp');
 assert.equal(all.find(x=>x.key==='onion||measured').label,'Onion — 5');
 assert.equal(all.find(x=>x.key==='rice|ml|measured').label,'Rice — 2 cups');
});
test('shopping preserves ranges, alternatives, preparation descriptors and package sizes',()=>{
 assert.equal(shopping.parse('1–2 onions').ambiguous,true);
 assert.equal(shopping.parse('2 tbsp butter or olive oil').ambiguous,true);
 assert.equal(shopping.parse('500g ground beef').name,'ground beef');
 assert.equal(shopping.parse('2 (15 oz) cans black beans').unit,'can (15 oz)');
 assert.equal(shopping.parse('½ teaspoon salt',2).qty,5);
 assert.equal(shopping.parse('For the sauce:'),null);
 assert.equal(shopping.parse('(select a fatty cut)'),null);
 assert.equal(shopping.parse('Dried oregano').name,'dried oregano');
});
test('edited/imported recipes normalize safe URLs and planner fields',()=>{
 const result=context.normalizeRecipe({id:'r',name:'Dinner',ingredients:['1 carrot'],directions:['Cook'],minutes:20,section:'main',source:{url:'javascript:alert(1)'},image:'javascript:alert(1)'});
 assert.equal(result.source.url,'');assert.equal(result.image,'');assert.equal(result.under30,true);assert.equal(result.isMain,true);
 assert.equal(result.serves.n,4);assert.deepEqual([...result.notes],[]);
});
test('sessions reject unsigned, tampered, expired and cross-origin requests',()=>{
 assert.equal(authenticated(request('sync')),true);
 assert.equal(authenticated(request('sync','GET',undefined,false)),false);
 assert.equal(authenticated(new Request('https://meal.example',{headers:{cookie:'mp_session='+token()+'bad'}})),false);
 assert.equal(authenticated(new Request('https://meal.example',{headers:{cookie:'mp_session='+token(Date.now()-40*86400000)}})),false);
 assert.equal(authorize(new Request('https://meal.example',{headers:{origin:'https://evil.example',cookie:'mp_session='+token()}})).status,403);
});
test('login protects credentials and uses secure HttpOnly cookie',async()=>{
 assert.equal((await session(request('session','POST',{password:'wrong'},false))).status,401);
 const res=await session(request('session','POST',{password:process.env.APP_PASSWORD},false));
 assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(res.headers.get('set-cookie'),/Secure/);
 assert.equal((await session(request('session','DELETE'))).status,200);
});
function memoryStore(){
 const data=new Map();let seq=0;
 return {
  async list(){return {blobs:[...data].map(([key,v])=>({key,etag:v.etag}))};},
  async getWithMetadata(key){const v=data.get(key);return v?{data:v.value,etag:v.etag}:null;},
  async setJSON(key,value,condition){
   const old=data.get(key);
   if(condition.onlyIfNew?!!old:old?.etag!==condition.onlyIfMatch)return {modified:false};
   const etag=String(++seq);data.set(key,{value,etag});return {modified:true,etag};
  }
 };
}
test('sync rejects unauthenticated access and protects concurrent device edits',async()=>{
 const handler=makeHandler(memoryStore);
 // Use one shared store for both devices.
 const store=memoryStore(),sync=makeHandler(()=>store);
 assert.equal((await sync(request('sync','GET',undefined,false))).status,401);
 let res=await sync(request('sync?key=mp.recipes','PUT',{value:{a:{name:'First'}},etag:null}));
 const first=await res.json();assert.equal(res.status,200);
 res=await sync(request('sync?key=mp.recipes','PUT',{value:{a:{name:'Device B'}},etag:first.etag}));assert.equal(res.status,200);
 res=await sync(request('sync?key=mp.recipes','PUT',{value:{a:{name:'Stale device A'}},etag:first.etag}));assert.equal(res.status,409);
 const current=await (await sync(request('sync?key=mp.recipes'))).json();assert.equal(current.value.a.name,'Device B');
 const index=await (await sync(request('sync'))).json();assert.equal(index.items.length,1);
 assert.equal(allowedKey('mp.chat'),false);assert.equal(allowedKey('../../secret'),false);
 assert.equal((await sync(request('sync?key=photo::x','PUT',{value:'not-image',etag:null}))).status,400);
});
test('recipe import blocks private destinations and parses nested schema',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','172.20.1.1','100.64.0.1','::1'])assert.equal(publicIP(ip),false,ip);
 assert.equal(publicIP('93.184.216.34'),true);
 await assert.rejects(readPublicPage('https://127.0.0.1/private'));
 await assert.rejects(readPublicPage('file:///etc/passwd'));
 const schema={'@graph':[{'@type':['Recipe'],name:'<b>Soup</b>',recipeIngredient:['1 carrot'],recipeInstructions:[{'@type':'HowToSection',itemListElement:[{text:'<p>Cook.</p>'}]}],recipeYield:'Serves 2',totalTime:'PT1H20M',image:{url:'https://example.com/soup.jpg'}}]};
 const r=extractRecipe('<script type="application/ld+json">'+JSON.stringify(schema)+'</script>','https://example.com/soup');
 assert.equal(r.name,'Soup');assert.deepEqual(r.directions,['Cook.']);assert.equal(r.minutes,80);assert.equal(r.serves.n,2);assert.equal(r.image,'https://example.com/soup.jpg');
 assert.throws(()=>extractRecipe('<h1>No recipe</h1>','https://example.com'));
});
test('assistant requires sign-in, bounds usage, and handles OpenAI responses',async()=>{
 assert.equal((await chat(request('chat','POST',{},false))).status,401);
 process.env.OPENAI_API_KEY='test-only-fake-key';
 const fetchBefore=globalThis.fetch;let payload;
 globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Cook the onions.'}]}]});};
 try{
  const body={system:'Cooking assistant.',messages:[{role:'user',content:'Help'}]};
  let res=await chat(request('chat','POST',body));assert.equal((await res.json()).text,'Cook the onions.');
  assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,2400);
  res=await chat(request('chat','POST',{...body,messages:[{role:'user',content:'x'.repeat(6001)}]}));assert.equal(res.status,400);
  globalThis.fetch=async()=>new Response('',{status:429});
  assert.equal((await chat(request('chat','POST',body))).status,502);
  assert.equal(chatConfig.rateLimit.windowLimit,10);
 }finally{globalThis.fetch=fetchBefore;delete process.env.OPENAI_API_KEY;}
});
test('two sync clients preserve offline edits and surface conflicts',async()=>{
 const store=memoryStore(),sync=makeHandler(()=>store);
 function client(){
  const disk=new Map(),values=new Map(),nav={onLine:true};
  const ctx=vm.createContext({
    window:{addEventListener(){}},document:{querySelectorAll:()=>[],addEventListener(){}},navigator:nav,
    localStorage:{getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v)},
    setInterval(){},setTimeout(){},clearTimeout(){},
    fetch:async(path,options={})=>{
      if(path.endsWith('/session'))return Response.json({signedIn:true,configured:true});
      return sync(request(path.replace(/^\//,''),options.method||'GET',options.body?JSON.parse(options.body):undefined));
    }
  });
  vm.runInContext(source('sync.js'),ctx);
  const api=ctx.window.Household;
  const adapter={keys:async()=>[...values.keys()],get:async k=>values.get(k)||null,set:async(k,v)=>values.set(k,v),refresh(){},escape:s=>s};
  return {api,values,nav,adapter};
 }
 const a=client(),b=client();
 a.values.set('mp.recipes',{one:'original'});
 await a.api.start(a.adapter);await b.api.start(b.adapter);
 assert.equal(b.values.get('mp.recipes').one,'original');
 a.nav.onLine=false;a.values.set('mp.recipes',{one:'offline edit'});a.api.track('mp.recipes');await a.api.sync();
 assert.equal((await store.getWithMetadata('mp.recipes')).data.one,'original');
 b.values.set('mp.recipes',{one:'other device edit'});b.api.track('mp.recipes');await b.api.sync();
 a.nav.onLine=true;await a.api.sync();
 assert.equal(a.api.status(),'Review sync conflicts');
 assert.equal(a.values.get('mp.recipes').one,'offline edit');
 assert.equal((await store.getWithMetadata('mp.recipes')).data.one,'other device edit');
});
