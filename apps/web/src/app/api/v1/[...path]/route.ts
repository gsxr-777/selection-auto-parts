import {app} from '@selection/api/server';
import {isIP} from 'node:net';
export const runtime='nodejs';
async function handle(request:Request,{params}:{params:Promise<{path:string[]}>}) {
  const {path}=await params;
  const url=new URL(request.url);
  // Vercel overwrites x-forwarded-for at its edge. Never trust it in standalone/local hosting.
  const forwarded=process.env.VERCEL==='1' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
  const response=await app.inject({method:'GET',url:`/api/v1/${path.join('/')}${url.search}`,headers:Object.fromEntries(request.headers),remoteAddress:forwarded&&isIP(forwarded)?forwarded:'127.0.0.1'});
  const headers=new Headers();
  for(const [key,value] of Object.entries(response.headers))if(typeof value==='string')headers.set(key,value);
  return new Response(response.body,{status:response.statusCode,headers});
}
export const GET=handle;
