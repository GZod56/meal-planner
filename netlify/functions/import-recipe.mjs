import {authorize,json,readJSON} from '../../server/security.mjs';
import {readPublicPage,extractRecipe} from '../../server/import-recipe.mjs';
export default async req=>{
 const denied=authorize(req);if(denied)return denied;
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
   const {url}=await readJSON(req,4000);
   if(typeof url!=='string'||url.length>2000)throw Error('Enter a recipe URL.');
   const page=await readPublicPage(url);
   return json({recipe:extractRecipe(page.html,page.url)});
 }catch(e){return json({error:e.message||'Could not import this recipe.'},400);}
};
export const config={path:'/.netlify/functions/import-recipe',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
