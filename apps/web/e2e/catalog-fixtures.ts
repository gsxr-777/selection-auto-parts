import type {BrowserContext} from '@playwright/test';
export async function mockCatalog(context:BrowserContext){
 await context.route('**/api/v1/**',route=>{
  const url=new URL(route.request().url()),ru=url.searchParams.get('locale')==='ru',modelId=url.searchParams.get('modelId');
  const model={id:'car:fixture',sourceId:'fixture',makeId:'fixture-ford',makeLabel:'FORD',kind:'car',label:ru?'FOCUS II седан (DB_)':'FOCUS II Saloon (DB_)'};
  const variant={id:'car:fixture-variant',modelId:model.id,label:'1.6',productionFrom:'2005-04-01',productionTo:'2012-09-30',powerKw:74,engineCode:'HWDA',fuel:'petrol',body:'sedan',transmission:null};
  if(url.pathname.endsWith('/selection'))return route.fulfill({json:{makes:[{id:'fixture-ford',label:'FORD'},{id:'fixture-other',label:'Other make'}],models:url.searchParams.get('makeId')==='fixture-ford'?[model]:[],fuels:modelId?['petrol','diesel','hybrid','electric']:[],bodies:modelId?['sedan']:[],transmissions:modelId?['unknown']:[],variants:modelId?[variant]:[],totalVariants:modelId?1:0}});
  if(url.pathname.endsWith('/models'))return route.fulfill({json:{status:'ready',data:[model]}});
  if(url.pathname.endsWith('/categories'))return route.fulfill({json:{status:'ready',data:[{id:'fixture-engine',label:ru?'Двигатель':'Engine',parentId:null,hasParts:false},{id:'fixture-piston',label:ru?'Поршень':'Piston',parentId:'fixture-engine',hasParts:true}]}});
  if(url.pathname.endsWith('/by-vehicle'))return route.fulfill({json:{total:1,page:1,limit:20,data:[{id:'fixture-part',brand:'Fixture manufacturer',number:'TEST-123',label:ru?'Поршень':'Piston',oe:[{manufacturer:'FORD',number:'OE-123',information:'',additive:false}],crosses:[{brand:'Fixture manufacturer',number:'TEST-122',type:'replaces'}],conditions:[{title:ru?'Код двигателя':'Engine code',value:'HWDA'}],fitmentGroups:[]}]}});
  return route.fulfill({status:404,json:{error:{code:'NOT_FOUND'}}});
 });
}
