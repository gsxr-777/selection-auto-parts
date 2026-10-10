import {beforeEach,afterEach,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const {loadFitments}=createRequire(import.meta.url)('../../../scripts/fitment-data.cjs');
const {hash}=createRequire(import.meta.url)('../../../scripts/catalog-data.cjs');
const workspace=fileURLToPath(new URL('../../../',import.meta.url)),cache=path.join(workspace,'.cache');
let directory:string;
const partId='fixture-brand:FIXTURE-1';
const prefix=()=>hash(partId).slice(0,24);
const filename=(locale:string)=>`${prefix()}-${locale}-00000.jsonl`;
const writeJson=(name:string,value:unknown)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value));
const writeRows=(locale:string,rows:unknown[])=>{const file=path.join(directory,filename(locale));fs.writeFileSync(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');fs.writeFileSync(file+'.complete',String(fs.statSync(file).size));};
const readRows=(locale:string)=>fs.readFileSync(path.join(directory,filename(locale)),'utf8').trim().split('\n').map(line=>JSON.parse(line));
beforeEach(()=>{
 fs.mkdirSync(cache,{recursive:true});directory=fs.mkdtempSync(path.join(cache,'fitment-test-'));
 const plan={version:1,release:'2/2018',country:'RUS',locales:['en','ru'],scope:'sample',sourceVariantId:'car:18953',variantIds:['car:1','car:2'],parts:[{id:partId,brandId:'fixture-brand',number:'FIXTURE-1',variantIds:null}]};
 writeJson('plan.json',plan);const planHash=hash(JSON.stringify(plan));
 writeJson('manifest.json',{version:1,release:'2/2018',country:'RUS',locales:['en','ru'],scope:'sample',extractedAt:'2026-10-10T00:00:00Z',planHash,method:'GetLinkedItemsV2/GetReverseArticleV2',relation:'CurrentArticle'});
 for(const locale of ['en','ru']){
  writeRows(locale,[{entity:'category',id:'1:fixture-root',sourceId:'fixture-root',parentId:null,label:`Root ${locale}`},{entity:'category',id:'1:fixture-light',sourceId:'fixture-light',parentId:'1:fixture-root',label:`Light ${locale}`},...['car:1','car:2'].map(variantId=>({entity:'fitment',partId,variantId,categoryId:'1:fixture-light',productId:'fixture-product',sequenceId:'1',foundVia:'CurrentArticle',label:`Fixture headlight ${locale}`,attributes:[{id:'fixture-side',title:`Side ${locale}`,value:'Left'}],conditions:[{general:[{id:'fixture-year',title:`Year to ${locale}`,value:'01.2008'}],alternatives:[[{id:'fixture-engine',title:'Engine',value:'A'}],[{id:'fixture-engine',title:'Engine',value:'B'}]],information:[`Source restriction ${locale}`]}]}))]);
  writeJson(`${prefix()}-${locale}.done.json`,{partId,locale,files:[filename(locale)],directTargets:2,parentExcluded:3,unsupported:0,outside:0,sampleExcluded:0});
 }
 writeJson('export.complete.json',{planHash,files:[filename('en'),filename('ru')]});
});
afterEach(()=>{
 if(!directory.startsWith(path.join(cache,'fitment-test-'))||path.relative(workspace,directory).startsWith('..'))throw new Error('Unsafe fixture cleanup');
 fs.rmSync(directory,{recursive:true,force:true});
});
it('keeps exact multi-vehicle keys, localized restrictions and alternative blocks; streaming has the same result',()=>{
 const result=loadFitments(directory);expect(result.counts).toEqual({parts:1,categories:2,fitments:2,variants:2});
 const expectedId=hash(JSON.stringify(['car:2',partId,'1:fixture-light','fixture-product','1']));
 const fitment=result.fitments.get(expectedId);expect(fitment.attributes.ru.conditions[0]).toMatchObject({general:[{value:'01.2008'}],alternatives:[[{value:'A'}],[{value:'B'}]]});
 const streaming=loadFitments(directory,{retainFitments:false});expect(streaming.fitments.size).toBe(0);expect(streaming.counts).toEqual(result.counts);
 expect([...streaming.chunks()][0].fitments.get(expectedId)).toEqual(fitment);
 expect(loadFitments(directory).fileHash).toBe(result.fileHash);
});
it('rejects a partial export and a changed chunk before importing',()=>{
 const complete=path.join(directory,filename('ru')+'.complete');fs.unlinkSync(complete);expect(()=>loadFitments(directory)).toThrow('Fitment chunk is incomplete');
 fs.writeFileSync(complete,'0');expect(()=>loadFitments(directory)).toThrow('Fitment chunk is incomplete');
 fs.unlinkSync(path.join(directory,'export.complete.json'));expect(()=>loadFitments(directory)).toThrow('Fitment export is incomplete');
});
it('rejects inferred parent-article links and vehicles outside the imported catalog',()=>{
 const rows=readRows('ru');rows[2].foundVia='ParentArticle';writeRows('ru',rows);expect(()=>loadFitments(directory)).toThrow('Invalid source row');
 rows[2].foundVia='CurrentArticle';rows[2].variantId='car:unknown';writeRows('ru',rows);expect(()=>loadFitments(directory)).toThrow('Fitment outside export scope');
});
it('rejects source sequence or target differences across locales',()=>{
 const rows=readRows('ru');rows[2].sequenceId='2';writeRows('ru',rows);expect(()=>loadFitments(directory)).toThrow('Incomplete localized linkage');
});
it('rejects conflicting restrictions for the same source linkage',()=>{
 const rows=readRows('en');rows.push({...rows[2],conditions:[]});writeRows('en',rows);expect(()=>loadFitments(directory)).toThrow('Conflicting exact source linkage');
});
it('rejects missing target category ancestry and a changed export plan',()=>{
 const rows=readRows('en');rows[1].parentId='1:missing';writeRows('en',rows);expect(()=>loadFitments(directory)).toThrow('Target category conflict');
 fs.appendFileSync(path.join(directory,'plan.json'),' ');expect(()=>loadFitments(directory)).toThrow('Fitment plan/manifest mismatch');
});
it('rejects candidate counts that would hide unprocessed vehicle targets',()=>{
 writeJson(`${prefix()}-ru.done.json`,{partId,locale:'ru',files:[filename('ru')],directTargets:3,parentExcluded:3,unsupported:0,outside:0,sampleExcluded:0});
 expect(()=>loadFitments(directory)).toThrow('Locale target coverage mismatch');
});
it('requires explicit sample scope at the common importer entry point',()=>{
 const importer=path.join(workspace,'scripts/import-catalog.cjs');
 const rejected=spawnSync(process.execPath,[importer,'--fitments','--directory',directory,'--validate'],{cwd:workspace,encoding:'utf8'});
 expect(rejected.status).toBe(1);expect(rejected.stderr).toContain('Specify --sample');
 const accepted=spawnSync(process.execPath,[importer,'--fitments','--directory',directory,'--sample','--validate'],{cwd:workspace,encoding:'utf8'});
 expect(accepted.status).toBe(0);expect(accepted.stdout).toContain("scope: 'sample'");
});
