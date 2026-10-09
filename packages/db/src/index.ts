import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from './generated/client';
import type {Prisma} from './generated/client';
import {localizedLabel,emptySelection,type Locale,type VehicleModel,type SelectionQuery,type Selection,type PartResults,type ReferencesQuery,type ReferencesResult} from '@selection/core';
export function createDatabase(url:string){return new PrismaClient({adapter:new PrismaPg({connectionString:url,max:3,connectionTimeoutMillis:5000})});}
const label=(labels:Prisma.JsonValue,locale:Locale)=>localizedLabel(labels as Partial<Record<Locale,string>>,locale,(labels as Record<string,string>).en||'');
type SourceAttribute={title:string;value:string};
type SourceConditions={label?:string;attributes:SourceAttribute[];conditions:{general:SourceAttribute[];alternatives:SourceAttribute[][];information:string[]}[]};
const fitmentLocale=(value:Prisma.JsonValue,locale:Locale)=>{const values=value as Record<string,SourceConditions>;return values[locale]||values.en||{attributes:[],conditions:[]};};
type ModelQuery={locale:Locale;makeId?:string;kind?:'car'|'motorcycle';ids?:string[]};
export interface VehicleCatalogRepository {
 models(input:ModelQuery):Promise<VehicleModel[]>;
 selection(input:SelectionQuery):Promise<Selection>;
 categories(input:{locale:Locale;variantId:string}):Promise<{id:string;label:string;parentId:string|null;hasParts:boolean}[]>;
 parts(input:{locale:Locale;variantId:string;categoryId:string;page:number;limit:number}):Promise<PartResults>;
 references(input:ReferencesQuery):Promise<ReferencesResult>;
}
export const unavailableVehicleCatalog:VehicleCatalogRepository={async models(){return [];},async selection(){return emptySelection;},async categories(){return [];},async parts(input){return {data:[],total:0,page:input.page,limit:input.limit};},async references(input){return {oe:[],crosses:[],total:0,page:input.page,limit:input.limit};}};
export function databaseCatalog(db:PrismaClient):VehicleCatalogRepository{
 const modelDto=(r:{id:string;sourceId:string;makeId:string;labels:Prisma.JsonValue;kind:string;make:{labels:Prisma.JsonValue}},locale:Locale):VehicleModel=>({id:r.id,sourceId:r.sourceId,makeId:r.makeId,label:label(r.labels,locale),makeLabel:label(r.make.labels,locale),kind:r.kind as 'car'|'motorcycle'});
 const oeDto=(oe:{manufacturer:string;number:string;informationLabels:Prisma.JsonValue;information:string;additive:boolean},locale:Locale)=>({manufacturer:oe.manufacturer,number:oe.number,information:label(oe.informationLabels,locale)||oe.information,additive:oe.additive});
 const crossDto=(c:{targetBrand:string;targetNumber:string;relationType:string})=>({brand:c.targetBrand,number:c.targetNumber,type:c.relationType as 'replaces'|'replaced_by'});
 return {
  async models(input){
   if(!input.makeId&&!input.ids)return [];
   // The inspected snapshot has at most 620 models per make/kind; never fetch the whole catalog.
   const rows=await db.vehicleModel.findMany({where:{makeId:input.makeId,kind:input.kind,id:input.ids?{in:input.ids}:undefined},include:{make:true},take:1000,orderBy:{id:'asc'}});
   return rows.map(r=>modelDto(r,input.locale)).sort((a,b)=>a.label.localeCompare(b.label,input.locale));
  },
  async selection(input){
   const makes=(await db.vehicleMake.findMany({where:{models:{some:{kind:input.kind}}},orderBy:{id:'asc'}})).map(r=>({id:r.id,label:label(r.labels,input.locale)})).sort((a,b)=>a.label.localeCompare(b.label,input.locale));
   const models=input.makeId?await this.models(input):[];
   if(!input.modelId||!models.some(r=>r.id===input.modelId))return {...emptySelection,makes,models};
   const base={modelId:input.modelId};const filter=(v:string|undefined)=>v==='unknown'?null:v;
   const [fuels,bodies,transmissions,variants,totalVariants]=await Promise.all([
    db.vehicleVariant.findMany({where:base,distinct:['fuel'],select:{fuel:true}}),
    db.vehicleVariant.findMany({where:{...base,fuel:filter(input.fuel)},distinct:['body'],select:{body:true}}),
    db.vehicleVariant.findMany({where:{...base,fuel:filter(input.fuel),body:filter(input.body)},distinct:['transmission'],select:{transmission:true}}),
    db.vehicleVariant.findMany({where:{...base,fuel:filter(input.fuel),body:filter(input.body),transmission:filter(input.transmission)},take:500,orderBy:{id:'asc'}}),
    db.vehicleVariant.count({where:{...base,fuel:filter(input.fuel),body:filter(input.body),transmission:filter(input.transmission)}})
   ]);
   return {makes,models,fuels:fuels.map(r=>r.fuel||'unknown').sort(),bodies:bodies.map(r=>r.body||'unknown').sort(),transmissions:transmissions.map(r=>r.transmission||'unknown').sort(),totalVariants,variants:variants.map(r=>({id:r.id,modelId:r.modelId,label:label(r.labels,input.locale),productionFrom:r.productionFrom?.toISOString().slice(0,10)||null,productionTo:r.productionTo?.toISOString().slice(0,10)||null,powerKw:r.powerKw,engineCode:r.engineCode,fuel:r.fuel,body:r.body,transmission:r.transmission}))};
  },
  async categories(input){
   const linked=await db.partCategory.findMany({where:{fitments:{some:{variantId:input.variantId}}}});if(!linked.length)return [];
   const all=await db.partCategory.findMany();const needed=new Set(linked.map(r=>r.id)),direct=new Set(needed);const byId=new Map(all.map(r=>[r.id,r]));
   for(const r of linked){let parent=r.parentId;while(parent&&!needed.has(parent)){needed.add(parent);parent=byId.get(parent)?.parentId||null;}}
   return all.filter(r=>needed.has(r.id)).map(r=>({id:r.id,label:label(r.labels,input.locale),parentId:r.parentId,hasParts:direct.has(r.id)}));
  },
  async parts(input){
   const where={fitments:{some:{variantId:input.variantId,categoryId:input.categoryId}}};
   const [total,rows]=await Promise.all([db.part.count({where}),db.part.findMany({where,skip:(input.page-1)*input.limit,take:input.limit,orderBy:[{brand:{label:'asc'}},{number:'asc'}],include:{brand:true,_count:{select:{oeNumbers:true,crosses:true}},oeNumbers:{take:20,orderBy:{position:'asc'}},crosses:{take:20,orderBy:{id:'asc'}},fitments:{where:{variantId:input.variantId,categoryId:input.categoryId}}}})]);
   return {total,page:input.page,limit:input.limit,data:rows.map(r=>({id:r.id,brand:r.brand.label,number:r.number,label:r.fitments.map(f=>fitmentLocale(f.attributes,input.locale).label).find(Boolean)||label(r.labels,input.locale),oe:r.oeNumbers.map(oe=>oeDto(oe,input.locale)),oeTotal:r._count.oeNumbers,crosses:r.crosses.map(crossDto),crossesTotal:r._count.crosses,conditions:r.fitments.flatMap(f=>fitmentLocale(f.attributes,input.locale).attributes).filter((a,i,all)=>all.findIndex(b=>b.title===a.title&&b.value===a.value)===i),fitmentGroups:r.fitments.flatMap(f=>fitmentLocale(f.attributes,input.locale).conditions)}))};
  },
  async references(input){
   const where={partId:input.partId},skip=(input.page-1)*input.limit;
   if(input.kind==='oe'){
    const [total,rows]=await Promise.all([db.oeReference.count({where}),db.oeReference.findMany({where,skip,take:input.limit,orderBy:{position:'asc'}})]);
    return {total,oe:rows.map(r=>oeDto(r,input.locale)),crosses:[],page:input.page,limit:input.limit};
   }
   const [total,rows]=await Promise.all([db.partCross.count({where}),db.partCross.findMany({where,skip,take:input.limit,orderBy:{id:'asc'}})]);
   return {total,oe:[],crosses:rows.map(crossDto),page:input.page,limit:input.limit};
  }
 };
}
