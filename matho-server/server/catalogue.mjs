/* Shared originals are read-only and require an active, approved teacher session. */
export function createCatalogue(db,{accounts,origins=['https://scrivix.us']}={}){
 return async request=>{
  const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Origin, Cookie','X-Content-Type-Options':'nosniff'};
  if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type, X-Matho-CSRF','Access-Control-Allow-Methods':'GET, OPTIONS'});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  try{
   if(origin&&!origins.includes(origin))return json({error:'Open MATHO from the official website.'},403);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(!accounts?.enabled)return json({error:'Teacher sign-in is required to view question sets.'},503);
   const teacher=await accounts.user(request);
   if(!['owner','teacher'].includes(teacher.role))return json({error:'An approved teacher account is required.'},403);
   if(request.method!=='GET')return json({error:'Shared originals are read-only. Copy this set to your library to edit.'},405);
   const match=new URL(request.url).pathname.match(/^\/v1\/teacher-sets\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
   if(!match)return json({error:'Question set not found.'},404);
   const row=await db.prepare('SELECT config,bank,updated FROM builtin_question_sets WHERE slug=?').bind(match[1]).first();
   if(!row)return json({error:'Question set not found.'},404);
   return json({config:JSON.parse(row.config),bank:JSON.parse(row.bank),updated:row.updated});
  }catch(error){return json({error:error.status?error.message:'Question sets are temporarily unavailable.'},error.status||503);}
 };
}
