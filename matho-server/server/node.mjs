import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRelay} from './relay.mjs';
export function sqliteAdapter(sqlite){return{prepare(sql){return{bind(...args){return{async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return{results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);}};}};}};}
export function openStore(filename=':memory:'){const db=new DatabaseSync(filename);db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));return db;}
export function serverFor(handle){return createServer(async(req,res)=>{try{const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>65536){res.writeHead(413);res.end();return;}chunks.push(c);}const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});const reply=await handle(request);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));}catch{res.writeHead(500);res.end('Room service error');}});}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const db=openStore(process.env.MATHO_DB||'matho-rooms.sqlite');
 const origins=(process.env.MATHO_ORIGINS||'https://scrivix.us,http://localhost:8765').split(',');
 const server=serverFor(createRelay(sqliteAdapter(db),{origins}));
 const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log('MATHO HTTPS-compatible relay ready on http://'+host+':'+port));
}
