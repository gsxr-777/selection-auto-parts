import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {modelsQuerySchema,modelListSchema} from '@selection/core';
import {createDatabase,unavailableVehicleCatalog,type VehicleCatalogRepository} from '@selection/db';

export function buildApp(repository:VehicleCatalogRepository=unavailableVehicleCatalog, databaseUrl=process.env.DATABASE_URL) {
  const app=Fastify({logger:false});
  app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  const db=databaseUrl ? createDatabase(databaseUrl) : null;
  app.addHook('onClose',async()=>{await db?.$disconnect();});
  app.setErrorHandler((error,request,reply)=>{void request; const status = error && typeof error==='object' && 'statusCode' in error && typeof error.statusCode==='number' ? error.statusCode : 500; reply.code(status).send({error:{code:status===429?'RATE_LIMITED':'INTERNAL_ERROR'}});});
  app.after(()=>{
  app.get('/api/v1/health',async()=>({status:'ok',catalog:'not_imported'}));
  app.get('/api/v1/health/database',async(_,reply)=>{
    if(!db)return reply.code(503).send({error:{code:'DATABASE_UNAVAILABLE'}});
    try { await db.$queryRaw`SELECT 1`; return {status:'ok'}; }
    catch {return reply.code(503).send({error:{code:'DATABASE_UNAVAILABLE'}});}
  });
  app.get('/api/v1/vehicles/models',async(request,reply)=>{
    const parsed=modelsQuerySchema.safeParse(request.query);
    if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_QUERY'}});
    const data=await repository.models(parsed.data);
    reply.header('Cache-Control','public, max-age=60');
    return modelListSchema.parse({data,status:data.length?'ready':'empty'});
  });
  });
  return app;
}
export const app=buildApp();
