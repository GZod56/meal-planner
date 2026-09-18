import {getStore} from '@netlify/blobs';
import {authorize,json,readJSON} from '../../server/security.mjs';
export const allowedKey=key=>typeof key==='string'&&/^(mp\.(plan|history|deletedRecipes|recipes)|mp\.(sides|prep|shop)::.{1,100}|photo::[a-zA-Z0-9_-]{1,150})$/.test(key);
export function makeHandler(storeFactory=()=>getStore({name:'meal-planner-household',consistency:'strong'})){
 return async req=>{
  const denied=authorize(req);if(denied)return denied;
  const key=new URL(req.url).searchParams.get('key');
  if(key&&!allowedKey(key))return json({error:'Invalid sync key.'},400);
  try{
   const store=storeFactory();
   if(req.method==='GET'){
     if(!key){const {blobs}=await store.list();return json({items:blobs.filter(b=>allowedKey(b.key))});}
     const item=await store.getWithMetadata(key,{type:'json'});
     return json(item?{value:item.data,etag:item.etag}:{value:null,etag:null});
   }
   if(req.method!=='PUT'||!key)return json({error:'Method not allowed.'},405);
   const {value,etag}=await readJSON(req,key.startsWith('photo::')?1500000:2000000);
   if(etag!==null&&typeof etag!=='string')return json({error:'Missing version.'},400);
   if(value===undefined)return json({error:'Missing value.'},400);
   if(key.startsWith('photo::')&&(typeof value!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)))return json({error:'Invalid photo.'},400);
   const result=await store.setJSON(key,value,etag?{onlyIfMatch:etag}:{onlyIfNew:true});
   if(!result.modified)return json({error:'This item changed on another device. Choose which version to keep.'},409);
   return json({etag:result.etag});
  }catch{return json({error:'Could not sync this item. Your local copy is kept; try again.'},503);}
 };
}
export default makeHandler();
export const config={path:'/.netlify/functions/sync',rateLimit:{windowLimit:300,windowSize:60,aggregateBy:['ip','domain']}};
