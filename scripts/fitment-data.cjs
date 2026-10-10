const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const {z}=createRequire(path.resolve('packages/catalog-core/package.json'))('zod');
const {hash,readRows}=require('./catalog-data.cjs');
const id=z.string().min(1).max(128),variantId=id.regex(/^(car|motorcycle):[^:]+$/);
const attribute=z.object({id:z.string(),title:z.string(),value:z.string()}).strict();
const condition=z.object({general:z.array(attribute),alternatives:z.array(z.array(attribute)),information:z.array(z.string())}).strict();
const planSchema=z.object({version:z.literal(1),release:z.literal('2/2018'),country:z.literal('RUS'),locales:z.tuple([z.literal('en'),z.literal('ru')]),scope:z.enum(['sample','existing-parts']),sourceVariantId:z.literal('car:18953'),variantIds:z.array(variantId),parts:z.array(z.object({id,brandId:id,number:z.string().min(1).max(256),variantIds:z.array(variantId).nullable()}).strict()).min(1)}).strict();
const manifestSchema=z.object({version:z.literal(1),release:z.literal('2/2018'),country:z.literal('RUS'),locales:z.tuple([z.literal('en'),z.literal('ru')]),extractedAt:z.string().refine(v=>Number.isFinite(Date.parse(v))),scope:z.enum(['sample','existing-parts']),planHash:z.string().regex(/^[a-f0-9]{64}$/),method:z.literal('GetLinkedItemsV2/GetReverseArticleV2'),relation:z.literal('CurrentArticle')}).strict();
const filename=z.string().regex(/^[a-f0-9]{24}-(en|ru)-\d{5}\.jsonl$/);
const doneSchema=z.object({partId:id,locale:z.enum(['en','ru']),files:z.array(filename),directTargets:z.number().int().nonnegative(),parentExcluded:z.number().int().nonnegative(),unsupported:z.number().int().nonnegative(),outside:z.number().int().nonnegative(),sampleExcluded:z.number().int().nonnegative()}).strict();
const rowSchema=z.discriminatedUnion('entity',[
 z.object({entity:z.literal('category'),id,sourceId:id,parentId:id.nullable(),label:z.string()}).strict(),
 z.object({entity:z.literal('fitment'),partId:id,variantId,categoryId:id,productId:id,sequenceId:id,foundVia:z.literal('CurrentArticle'),label:z.string(),attributes:z.array(attribute),conditions:z.array(condition)}).strict()
]);
function loadFitments(directory,{retainFitments=true}={}){
 const planText=fs.readFileSync(path.join(directory,'plan.json'),'utf8'),plan=planSchema.parse(JSON.parse(planText));
 const manifest=manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8')));
 if(hash(planText)!==manifest.planHash||manifest.scope!==plan.scope)throw new Error('Fitment plan/manifest mismatch');
 const completePath=path.join(directory,'export.complete.json');if(!fs.existsSync(completePath))throw new Error('Fitment export is incomplete');
 const complete=z.object({planHash:z.string(),files:z.array(filename)}).strict().parse(JSON.parse(fs.readFileSync(completePath,'utf8')));
 if(complete.planHash!==manifest.planHash)throw new Error('Fitment completion plan mismatch');
 const categories=new Map(),fitments=new Map(),allowed=new Set(plan.variantIds),files=[],audits=[],partAudits=new Map();
 if(allowed.size!==plan.variantIds.length||new Set(plan.parts.map(p=>p.id)).size!==plan.parts.length)throw new Error('Duplicate plan IDs');
 for(const locale of plan.locales)for(const part of plan.parts){
  if(part.id!==`${part.brandId}:${part.number}`)throw new Error('Part source identity mismatch');
  const prefix=hash(part.id).slice(0,24)+'-'+locale;
  const donePath=path.join(directory,prefix+'.done.json');if(!fs.existsSync(donePath))throw new Error('Part fitment export is incomplete: '+part.id);
  const audit=doneSchema.parse(JSON.parse(fs.readFileSync(donePath,'utf8')));
  if(audit.partId!==part.id||audit.locale!==locale||new Set(audit.files).size!==audit.files.length||audit.files.some((f,i)=>f!==`${prefix}-${String(i).padStart(5,'0')}.jsonl`))throw new Error('Fitment chunk identity mismatch');
  audits.push(audit);partAudits.set(prefix,audit);
  for(const name of audit.files){
   const file=path.join(directory,name);if(!fs.existsSync(file)||!fs.existsSync(file+'.complete')||fs.readFileSync(file+'.complete','utf8').trim()!==String(fs.statSync(file).size))throw new Error('Fitment chunk is incomplete: '+name);
   files.push(name);
  }
 }
 if(JSON.stringify(files)!==JSON.stringify(complete.files))throw new Error('Fitment completion files mismatch');
 function* chunks(){
  for(const part of plan.parts){
   const prefix=hash(part.id).slice(0,24),en=partAudits.get(prefix+'-en'),ru=partAudits.get(prefix+'-ru');
   if(en.directTargets!==ru.directTargets||en.files.length!==ru.files.length)throw new Error('Locale target coverage mismatch '+part.id);
   const targets=new Set();
   for(let index=0;index<en.files.length;index++){
    const chunkCategories=new Map(),chunkFitments=new Map(),localeTargets=[];
    for(const locale of plan.locales){
     const audit=partAudits.get(prefix+'-'+locale),file=path.join(directory,audit.files[index]),targetIds=new Set();
     for(const row of readRows(file,rowSchema)){
      if(row.entity==='category'){
       let category=chunkCategories.get(row.id);if(!category){category={id:row.id,sourceId:row.sourceId,parentId:row.parentId,labels:{}};chunkCategories.set(row.id,category);}
       if(category.sourceId!==row.sourceId||category.parentId!==row.parentId||(locale in category.labels&&category.labels[locale]!==row.label))throw new Error('Target category conflict '+row.id);
       category.labels[locale]=row.label;continue;
      }
      if(row.partId!==part.id||!allowed.has(row.variantId)||(part.variantIds&&!part.variantIds.includes(row.variantId)))throw new Error('Fitment outside export scope');
      targetIds.add(row.variantId);
      const fitmentId=hash(JSON.stringify([row.variantId,row.partId,row.categoryId,row.productId,row.sequenceId]));
      let fitment=chunkFitments.get(fitmentId);if(!fitment){fitment={id:fitmentId,partId:row.partId,variantId:row.variantId,categoryId:row.categoryId,attributes:{sourceSequenceId:row.sequenceId,sourceProductId:row.productId}};chunkFitments.set(fitmentId,fitment);}
      const content={label:row.label,attributes:row.attributes,conditions:row.conditions};
      if(fitment.attributes[locale]&&JSON.stringify(fitment.attributes[locale])!==JSON.stringify(content))throw new Error('Conflicting exact source linkage '+fitmentId);
      fitment.attributes[locale]=content;
     }
     localeTargets.push([...targetIds].sort());
    }
    if(JSON.stringify(localeTargets[0])!==JSON.stringify(localeTargets[1]))throw new Error('Locale linkage targets differ '+part.id);
    for(const id of localeTargets[0]){if(targets.has(id))throw new Error('Target repeated across fitment chunks '+id);targets.add(id);}
    for(const fitment of chunkFitments.values())if(!chunkCategories.has(fitment.categoryId)||!fitment.attributes.en||!fitment.attributes.ru)throw new Error('Incomplete localized linkage '+fitment.id);
    for(const category of chunkCategories.values())if(!('en' in category.labels)||!('ru' in category.labels)||(category.parentId&&!chunkCategories.has(category.parentId)))throw new Error('Incomplete target category '+category.id);
    yield {categories:chunkCategories,fitments:chunkFitments};
   }
   if(targets.size!==en.directTargets)throw new Error('Incomplete target coverage '+part.id);
  }
 }
 let fitmentCount=0;const variantIds=new Set();
 for(const chunk of chunks()){
  for(const category of chunk.categories.values()){
   const previous=categories.get(category.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(category))throw new Error('Target category conflict '+category.id);
   categories.set(category.id,category);
  }
  for(const fitment of chunk.fitments.values()){if(retainFitments)fitments.set(fitment.id,fitment);variantIds.add(fitment.variantId);fitmentCount++;}
 }
 for(const category of categories.values()){
  if(!('en' in category.labels)||!('ru' in category.labels)||(category.parentId&&!categories.has(category.parentId)))throw new Error('Incomplete target category '+category.id);
  let current=category;const visited=new Set();while(current){if(visited.has(current.id))throw new Error('Category cycle');visited.add(current.id);current=categories.get(current.parentId);}
 }
 const fileHash=hash([hash(planText),hash(fs.readFileSync(path.join(directory,'manifest.json'))),...files.map(name=>hash(fs.readFileSync(path.join(directory,name)))),...audits.map(audit=>hash(JSON.stringify(audit)))].join('|'));
 return {plan,manifest,fileHash,categories,fitments,chunks,audits,variantIds:[...variantIds],counts:{parts:plan.parts.length,categories:categories.size,fitments:fitmentCount,variants:variantIds.size}};
}
module.exports={loadFitments};
