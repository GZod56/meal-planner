import fs from 'node:fs/promises';
import {readPublicPage,extractRecipe} from '../server/import-recipe.mjs';

const recipes=JSON.parse(await fs.readFile('recipes.json','utf8'));
const report={generatedAt:new Date().toISOString(),total:recipes.length,withSource:0,verified:0,changed:0,failed:[]};
const queue=recipes.map((r,i)=>({r,i})).filter(x=>x.r?.source?.url);
report.withSource=queue.length;

function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function cleanSourceName(url){try{return new URL(url).hostname}catch{return ''}}

async function verify({r}){
  const url=r.source?.url;
  try{
    const page=await readPublicPage(url);
    const src=extractRecipe(page.html,page.url);
    if(!src.ingredients?.length||!src.directions?.length)throw Error('Source recipe missing ingredients or directions.');
    const before={ingredients:r.ingredients,directions:r.directions,serves:r.serves,image:r.image,minutes:r.minutes};
    r.ingredients=src.ingredients;
    r.directions=src.directions;
    r.serves=src.serves;
    if(src.image)r.image=src.image;
    if(Number.isFinite(src.minutes)&&src.minutes>0)r.minutes=src.minutes;
    r.source={...r.source,url:page.url,name:r.source?.name||cleanSourceName(page.url)};
    const after={ingredients:r.ingredients,directions:r.directions,serves:r.serves,image:r.image,minutes:r.minutes};
    report.verified++;
    if(!same(before,after))report.changed++;
  }catch(err){
    report.failed.push({id:r.id,name:r.name,url,error:String(err?.message||err)});
  }
}

let next=0;
await Promise.all(Array.from({length:4},async()=>{
  while(true){
    const pos=next++;
    if(pos>=queue.length)return;
    await verify(queue[pos]);
  }
}));

await fs.writeFile('recipes.json',JSON.stringify(recipes,null,1)+'\n');
await fs.writeFile('recipe-source-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,withSource:report.withSource,verified:report.verified,changed:report.changed,failed:report.failed.length}));
