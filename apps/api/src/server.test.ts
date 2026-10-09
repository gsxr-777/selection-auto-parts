import {it,expect} from 'vitest';
import {buildApp} from './server';
import {unavailableVehicleCatalog} from '@selection/db';
it('returns an explicit empty catalog and validates API queries',async()=>{const app=buildApp(unavailableVehicleCatalog,'');try{
  const response=await app.inject('/api/v1/vehicles/models?locale=en');expect(response.statusCode).toBe(200);expect(response.json()).toEqual({data:[],status:'empty'});
  for(const query of ['locale=de','makeId=','limit=100000'])expect((await app.inject('/api/v1/vehicles/models?'+query)).statusCode).toBe(400);
}finally{await app.close();}});
it('reports unavailable database without credentials in the response',async()=>{const app=buildApp(undefined,'');try{const response=await app.inject('/api/v1/health/database');expect(response.statusCode).toBe(503);expect(response.json()).toEqual({error:{code:'DATABASE_UNAVAILABLE'}});}finally{await app.close();}});
it('rate limits public requests',async()=>{const app=buildApp(undefined,'');try{await app.ready();for(let i=0;i<60;i++)await app.inject('/api/v1/vehicles/models');const response=await app.inject('/api/v1/vehicles/models');expect(response.statusCode).toBe(429);expect(response.json()).toEqual({error:{code:'RATE_LIMITED'}});}finally{await app.close();}});
it('validates dependent selection and paginated part lookups, including unavailable data',async()=>{
 const app=buildApp(unavailableVehicleCatalog,'');try{
  for(const url of ['/api/v1/vehicles/selection?modelId=car:1','/api/v1/vehicles/selection?fuel=petrol','/api/v1/vehicles/selection?kind=truck','/api/v1/parts/categories','/api/v1/parts/by-vehicle?variantId=car:1&categoryId=1:2&limit=51','/api/v1/parts/by-vehicle?variantId=car:1&categoryId=1:2&page=-1'])expect((await app.inject(url)).statusCode).toBe(400);
  const categories=await app.inject('/api/v1/parts/categories?variantId=car:missing');expect(categories.json()).toEqual({data:[],status:'empty'});
  const parts=await app.inject('/api/v1/parts/by-vehicle?variantId=car:missing&categoryId=missing');expect(parts.json()).toEqual({data:[],total:0,page:1,limit:20});
 }finally{await app.close();}
});
it('never exposes source exceptions or secrets when the repository fails',async()=>{
 const app=buildApp({...unavailableVehicleCatalog,async selection(){throw new Error('private provider path and password');}},'');try{const result=await app.inject('/api/v1/vehicles/selection');expect(result.statusCode).toBe(500);expect(result.json()).toEqual({error:{code:'INTERNAL_ERROR'}});}finally{await app.close();}
});
it('bounds original and replacement reference pages',async()=>{
 const app=buildApp({...unavailableVehicleCatalog,async references(input){return {oe:[{manufacturer:'fixture',number:'REF-21',information:'',additive:false}],crosses:[],total:21,page:input.page,limit:input.limit};}},'');
 try{
  for(const query of ['partId=a&kind=oe&limit=101','partId=a&kind=unknown','partId=a&kind=crosses&page=0'])expect((await app.inject('/api/v1/parts/references?'+query)).statusCode).toBe(400);
  const response=await app.inject('/api/v1/parts/references?partId=a&kind=oe&page=2');expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({page:2,limit:20,total:21,oe:[{number:'REF-21'}]});
 }finally{await app.close();}
});
