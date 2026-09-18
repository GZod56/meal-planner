import { createHmac, timingSafeEqual } from 'node:crypto';
const COOKIE='mp_session';
const lifetime=30*24*60*60;
const secret=()=>process.env.APP_PASSWORD||'';
export const ready=()=>secret().length>=16;
const sign=s=>createHmac('sha256',secret()).update(s).digest('base64url');
export function same(a,b){
  const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export function token(now=Date.now()){
  const expires=String(Math.floor(now/1000)+lifetime);
  return expires+'.'+sign(expires);
}
export function authenticated(req,now=Date.now()){
  if(!ready())return false;
  const raw=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  const [expires,signature]=raw.split('.');
  return /^\d+$/.test(expires||'')&&Number(expires)>now/1000&&Number(expires)<=now/1000+lifetime+60&&same(signature||'',sign(expires));
}
export function cookie(req,value,age=lifetime){
  return COOKIE+'='+value+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+age+(new URL(req.url).protocol==='https:'?'; Secure':'');
}
export function json(body,status=200,headers={}){
  return Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
}
export function authorize(req){
  if(!ready())return json({error:'Household sign-in needs to be configured before using sync or the assistant.'},503);
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return json({error:'Request origin not allowed.'},403);
  if(!authenticated(req))return json({error:'Sign in to your household to continue.',login:true},401);
  return null;
}
export async function readJSON(req,maxBytes=100000){
  if(Number(req.headers.get('content-length'))>maxBytes)throw new Error('Request too large.');
  const reader=req.body?.getReader();if(!reader)throw new Error('Missing request.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new Error('Request too large.');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
