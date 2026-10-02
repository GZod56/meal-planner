import {authorize,json,readJSON} from '../../server/security.mjs';

export default async function voice(req){
  const denied=authorize(req);if(denied)return denied;
  if(req.method!=='POST')return new Response('POST only',{status:405});
  if(!process.env.OPENAI_API_KEY)return json({error:'Voice is not configured.'},503);
  let body;
  try{body=await readJSON(req,65000);}catch{return json({error:'Invalid session.'},400);}
  const {sdp,context}=body||{};
  if(typeof sdp!=='string'||sdp.length<100||sdp.length>40000||typeof context!=='string'||context.length>18000)return json({error:'Invalid session.'},400);
  const session={type:'realtime',model:'gpt-realtime-2.1',instructions:context,
    audio:{output:{voice:'marin'}},tools:[
      {type:'function',name:'navigate_step',description:'Advance or go back in the active on-screen recipe.',parameters:{type:'object',properties:{direction:{type:'string',enum:['next','back']}},required:['direction']}},
      {type:'function',name:'set_timer',description:'Start an independent cooking timer.',parameters:{type:'object',properties:{seconds:{type:'integer'},label:{type:'string'}},required:['seconds','label']}},
      {type:'function',name:'get_cook_state',description:'Get current step, scaled ingredients and running timers.',parameters:{type:'object',properties:{}}},
      {type:'function',name:'change_cook',description:'Replace the live session recipe steps and ingredients for tonight only. Include the complete revised steps and ingredient list.',parameters:{type:'object',properties:{directions:{type:'array',items:{type:'string'}},ingredients:{type:'array',items:{type:'string'}},summary:{type:'string'}},required:['directions','ingredients','summary']}},
      {type:'function',name:'save_cook_note',description:'Save a tested preference or variation for this recipe for future sessions.',parameters:{type:'object',properties:{note:{type:'string'}},required:['note']}}
    ]};
  const form=new FormData();form.set('sdp',sdp);form.set('session',JSON.stringify(session));
  try{
    const r=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(15000)});
    if(!r.ok)return json({error:'Could not start voice session.'},502);
    return new Response(await r.text(),{headers:{'content-type':'application/sdp','cache-control':'no-store'}});
  }catch{return json({error:'Could not connect to voice.'},502);}
}
