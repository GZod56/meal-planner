import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {load} from 'cheerio';
export function publicIP(ip){
 if(isIP(ip)!==4)return false;
 const [a,b]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0));
}
export async function readPublicPage(input,redirects=0){
 const url=new URL(input);
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||isIP(url.hostname))throw Error('Use a public HTTPS recipe link.');
 const addresses=await lookup(url.hostname,{all:true,family:4});
 if(!addresses.length||!addresses.every(a=>publicIP(a.address)))throw Error('This address is not a public recipe site.');
 const response=await new Promise((resolve,reject)=>{
   const req=https.get(url,{
     headers:{'user-agent':'MealPlanner/1.0 (recipe import)','accept':'text/html'},
     lookup:(_host,options,callback)=>callback(null,...(options?.all?[addresses]:[addresses[0].address,4]))
   },res=>{
     if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:res.headers.location});return;}
     if(res.statusCode!==200||!String(res.headers['content-type']).includes('text/html')){res.resume();reject(Error('This site did not provide a readable recipe. Paste the recipe manually instead.'));return;}
     const chunks=[];let size=0;
     res.on('data',c=>{size+=c.length;if(size>1500000){req.destroy(Error('Recipe page is too large.'));return;}chunks.push(c);});
     res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.href}));
     res.on('error',reject);
   });
   req.setTimeout(8000,()=>req.destroy(Error('Recipe site took too long to respond.')));
   const deadline=setTimeout(()=>req.destroy(Error('Recipe site took too long to respond.')),10000);
   req.on('close',()=>clearTimeout(deadline));req.on('error',reject);
 });
 if(response.redirect){if(redirects>=3)throw Error('Too many redirects.');return readPublicPage(new URL(response.redirect,url).href,redirects+1);}
 return response;
}
const array=x=>Array.isArray(x)?x:x?[x]:[];
export function extractRecipe(html,url){
 const $=load(html);
 const text=x=>typeof x==='string'?load(x).text().trim():'';
 const candidates=[];
 const walk=x=>{if(!x||typeof x!=='object')return;if(array(x['@type']).some(t=>String(t).toLowerCase()==='recipe'))candidates.push(x);for(const v of Object.values(x))if(typeof v==='object')for(const item of array(v))walk(item);};
 $('script[type="application/ld+json"]').each((_,el)=>{try{walk(JSON.parse($(el).text()));}catch{}});
 const r=candidates.find(x=>x.name&&array(x.recipeIngredient).length);
 if(!r)throw Error('No structured recipe found. You can paste the ingredients and directions into a new recipe instead.');
 const steps=x=>array(x).flatMap(v=>typeof v==='string'?[text(v)]:v?.itemListElement?steps(v.itemListElement):v?.text?[text(v.text)]:[]);
 const duration=String(r.totalTime||r.cookTime||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
 const n=Number(String(array(r.recipeYield)[0]||'4').match(/\d+(?:\.\d+)?/)?.[0])||4;
 let image=array(r.image)[0];if(image&&typeof image==='object')image=image.url;
 if(typeof image!=='string'||!image.startsWith('https://'))image='';
 const ingredients=array(r.recipeIngredient).map(text).filter(Boolean).slice(0,150);
 const proteinText=ingredients.filter(s=>!/\b(stock|broth)\b/i.test(s)).join(' ');
 const protein=[['Pork',/\b(pork|bacon|pancetta|ham)\b/i],['Beef',/\b(beef|brisket)\b/i],['Lamb',/\blamb\b/i],['Chicken',/\b(chicken|turkey)\b/i],['Seafood',/\b(shrimp|prawn|crab|lobster|scallop)\b/i],['Fish',/\b(fish|salmon|cod|tuna|halibut)\b/i],['Eggs',/\beggs?\b/i]].find(([,rx])=>rx.test(proteinText))?.[0]||'Vegetarian';
 const category=String(array(r.recipeCategory)[0]||'').toLowerCase();
 const archetype=['soup','stew','curry','salad'].find(x=>category.includes(x))||'complete';
 return {
  name:text(r.name).slice(0,180),ingredients,protein,archetype,
  directions:steps(r.recipeInstructions).filter(Boolean).slice(0,150),notes:[],
  serves:{n:Math.max(1,Math.min(n,100)),text:'Serves: '+n},
  minutes:duration?Number(duration[1]||0)*60+Number(duration[2]||0):30,
  source:{url,name:new URL(url).hostname},image,section:'main'
 };
}
