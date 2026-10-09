import {it,expect} from 'vitest';
import {buildApp} from './server';
it('returns an explicit empty catalog and validates API queries',async()=>{const app=buildApp(undefined,undefined);try{
  const response=await app.inject('/api/v1/vehicles/models?locale=en');expect(response.statusCode).toBe(200);expect(response.json()).toEqual({data:[],status:'empty'});
  for(const query of ['locale=de','makeId=','limit=100000'])expect((await app.inject('/api/v1/vehicles/models?'+query)).statusCode).toBe(400);
}finally{await app.close();}});
it('reports unavailable database without credentials in the response',async()=>{const app=buildApp(undefined,'');try{const response=await app.inject('/api/v1/health/database');expect(response.statusCode).toBe(503);expect(response.json()).toEqual({error:{code:'DATABASE_UNAVAILABLE'}});}finally{await app.close();}});
it('rate limits public requests',async()=>{const app=buildApp(undefined,'');try{await app.ready();for(let i=0;i<60;i++)await app.inject('/api/v1/vehicles/models');const response=await app.inject('/api/v1/vehicles/models');expect(response.statusCode).toBe(429);expect(response.json()).toEqual({error:{code:'RATE_LIMITED'}});}finally{await app.close();}});
