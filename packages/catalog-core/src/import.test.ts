import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {it,expect} from 'vitest';
import {selectionQuerySchema,partsQuerySchema,modelsQuerySchema} from './index';
const {canonicalAttributes,normalizeNumber,loadCatalog}=createRequire(import.meta.url)('../../../scripts/catalog-data.cjs');
it('only normalizes known source values, preserves missing gearbox and engine codes',()=>{
 const values=canonicalAttributes([{title:'Fuel type',value:'Petrol/Electric'},{title:'Body type',value:'Saloon'},{title:'Power',value:'74 kW'},{title:'Capacity (technic)',value:'1596 ccm'},{title:'Engine code',value:'HWDA'},{title:'Engine code',value:'SHDA'}]);
 expect(values).toMatchObject({fuel:'hybrid',body:'sedan',powerKw:74,displacementCm3:1596,engineCode:'HWDA, SHDA',transmission:null});
 expect(canonicalAttributes([{title:'Fuel type',value:'Electric'}]).fuel).toBe('electric');
 expect(canonicalAttributes([{title:'Transmission Type',value:'Unknown special type'}]).transmission).toBe('Unknown special type');
});
it('preserves OE characters while normalizing punctuation and width',()=>{expect(normalizeNumber('5M51 F406A10-AB')).toBe('5M51F406A10AB');expect(normalizeNumber('АБ-１２')).toBe('АБ12');});
it('requires parents, bounds pages and favorites lookup at API boundaries',()=>{
 expect(selectionQuerySchema.safeParse({modelId:'car:1'}).success).toBe(false);expect(selectionQuerySchema.safeParse({fuel:'petrol'}).success).toBe(false);
 expect(partsQuerySchema.safeParse({variantId:'car:1',categoryId:'1:2',limit:51}).success).toBe(false);expect(partsQuerySchema.safeParse({variantId:'car:1',categoryId:'1:2',page:0}).success).toBe(false);
 expect(modelsQuerySchema.safeParse({ids:Array.from({length:101},(_,i)=>String(i)).join(',')}).success).toBe(false);
});
it('preserves full references across repeated fitments and rejects unfinished exports',()=>{
 const workspace=fileURLToPath(new URL('../../../',import.meta.url)),cache=path.join(workspace,'.cache');fs.mkdirSync(cache,{recursive:true});
 const directory=fs.mkdtempSync(path.join(cache,'catalog-test-')),exportDir=path.join(directory,'catalog-export'),parentDir=path.join(directory,'catalog-parent-export');fs.mkdirSync(exportDir);fs.mkdirSync(parentDir);
 const write=(file:string,rows:unknown[],complete=false)=>{fs.writeFileSync(file,rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':''));if(complete)fs.writeFileSync(file+'.complete',String(fs.statSync(file).size));};
 try{
  fs.writeFileSync(path.join(exportDir,'manifest.json'),JSON.stringify({version:1,release:'2/2018',country:'RUS',locales:['en','ru'],extractedAt:'2026-10-09T00:00:00Z'}));
  for(const locale of ['en','ru']){
   write(path.join(exportDir,`vehicles-${locale}.jsonl`),[{entity:'make',id:'36',label:'FORD'},{entity:'model',id:'car:5454',sourceId:'5454',makeId:'36',kind:'car',label:'FOCUS II (DB_)',from:null,to:null},{entity:'variant',id:'car:18953',sourceId:'18953',modelId:'car:5454',label:'1.6',from:'2005-04-01',to:'2012-09-30',attributes:[{id:'fixture-power',title:'Power',value:'74 kW'}]}]);
   const part={entity:'part',id:'fixture-part',brandId:'fixture-brand',brand:'Fixture brand',number:'FIXTURE-1',label:'Fixture piston',categoryId:'fixture-category',variantId:'car:18953',sequenceId:'1',productId:'fixture-product',attributes:[],conditions:[],oe:[{manufacturerId:'fixture-oe',manufacturer:'Fixture OE',number:'FIXTURE-OE',additive:false,information:locale}],crosses:[{type:'replaces',number:'FIXTURE-OLD',brand:'Fixture brand',sourceId:null}]};
   write(path.join(exportDir,`parts-${locale}.jsonl`),[{entity:'category',id:'fixture-category',sourceId:'fixture-category',parentId:null,label:'Fixture engine',state:'fixture'},part,{...part,sequenceId:'2',oe:[],crosses:[],_references:false}],true);
   write(path.join(parentDir,`parts-${locale}.jsonl`),[],true);
  }
  const result=loadCatalog(exportDir,true);expect(result.counts).toMatchObject({part:1,fitment:2});
  const part=result.maps.part.get('fixture-part');expect(part.oe).toHaveLength(1);expect(part.crosses).toHaveLength(1);expect(part.oeTranslations.ru[0].information).toBe('ru');
  fs.unlinkSync(path.join(exportDir,'parts-ru.jsonl.complete'));expect(()=>loadCatalog(exportDir,true)).toThrow('Source pass is incomplete');
 }finally{
  if(!directory.startsWith(path.join(cache,'catalog-test-'))||path.relative(workspace,directory).startsWith('..'))throw new Error('Unsafe fixture cleanup');
  fs.rmSync(directory,{recursive:true,force:true});
 }
});
