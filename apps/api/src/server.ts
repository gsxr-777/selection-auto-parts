import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {modelsQuerySchema,modelListSchema,selectionQuerySchema,selectionSchema,categoriesQuerySchema,categoriesSchema,partsQuerySchema,partsResultSchema,referencesQuerySchema,referencesResultSchema} from '@selection/core';
import {createDatabase,databaseCatalog,unavailableVehicleCatalog,type VehicleCatalogRepository} from '@selection/db';

export function buildApp(providedRepository?:VehicleCatalogRepository, databaseUrl=process.env.DATABASE_URL) {
  const app=Fastify({logger:false});
  app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  const db=databaseUrl ? createDatabase(databaseUrl) : null;
  const repository=providedRepository||(db?databaseCatalog(db):unavailableVehicleCatalog);
  app.addHook('onClose',async()=>{await db?.$disconnect();});
  app.setErrorHandler((error,request,reply)=>{void request; const status = error && typeof error==='object' && 'statusCode' in error && typeof error.statusCode==='number' ? error.statusCode : 500; reply.code(status).send({error:{code:status===429?'RATE_LIMITED':'INTERNAL_ERROR'}});});
  app.after(()=>{
  app.get('/api/v1/health',async()=>({status:'ok'}));
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
  app.get('/api/v1/vehicles/selection',async(request,reply)=>{
    const parsed=selectionQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_QUERY'}});
    reply.header('Cache-Control','public, max-age=60');return selectionSchema.parse(await repository.selection(parsed.data));
  });
  app.get('/api/v1/parts/categories',async(request,reply)=>{
    const parsed=categoriesQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_QUERY'}});
    const data=await repository.categories(parsed.data);reply.header('Cache-Control','public, max-age=60');return categoriesSchema.parse({data,status:data.length?'ready':'empty'});
  });
  app.get('/api/v1/parts/by-vehicle',async(request,reply)=>{
    const parsed=partsQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_QUERY'}});
    reply.header('Cache-Control','public, max-age=60');return partsResultSchema.parse(await repository.parts(parsed.data));
  });
  app.get('/api/v1/parts/references',async(request,reply)=>{
    const parsed=referencesQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_QUERY'}});
    reply.header('Cache-Control','public, max-age=60');return referencesResultSchema.parse(await repository.references(parsed.data));
  });
  });
  return app;
}
export const app=buildApp();
