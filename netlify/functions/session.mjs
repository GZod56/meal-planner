import {ready,same,token,cookie,authenticated,json,readJSON} from '../../server/security.mjs';
export default async req=>{
  if(req.method==='GET')return json({configured:ready(),signedIn:authenticated(req)});
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return json({error:'Request origin not allowed.'},403);
  if(req.method==='DELETE')return json({signedIn:false},200,{'set-cookie':cookie(req,'',0)});
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  if(!ready())return json({error:'Add APP_PASSWORD (at least 16 characters) to Netlify Functions environment variables, then redeploy.'},503);
  try{
    const {password}=await readJSON(req,2000);
    if(typeof password!=='string'||!same(password,process.env.APP_PASSWORD))return json({error:'Incorrect household password.'},401);
    return json({signedIn:true},200,{'set-cookie':cookie(req,token())});
  }catch{return json({error:'Invalid sign-in request.'},400);}
};
export const config={path:'/.netlify/functions/session',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
