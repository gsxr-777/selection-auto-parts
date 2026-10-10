const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const requireDb=createRequire(path.resolve('packages/db/package.json'));
const {Client}=requireDb('pg');const dotenv=requireDb('dotenv');
const {loadCatalog,canonicalAttributes,normalizeNumber,hash}=require('./catalog-data.cjs');
const {upsert}=require('./catalog-db.cjs');
async function run(){
 const args=process.argv.slice(2),sample=args.includes('--sample');const envFile=args.includes('--production')?'.env.production.local':'.env';
 const {maps,manifest,fileHash,counts,referenceAudit}=loadCatalog(path.resolve('.cache/catalog-export'),sample,args.includes('--vehicles-only'),args.includes('--parent-sample'));
 if(args.includes('--validate')){console.log({mode:sample?'sample':'full',counts,fileHash,referenceAudit});return;}
 const env=dotenv.parse(fs.readFileSync(envFile));const client=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});await client.connect();
 const batchId='catalog-2018q2-'+(sample?'sample-':'full-')+fileHash.slice(0,16);
 try{await client.query('BEGIN');
  await upsert(client,'catalog_sources',[{id:'local-catalog-2018q2',name:'TecDoc desktop BDF',sourceVersion:manifest.release,licenseNotes:'Project owner confirmed extraction and web publication permission on 2026-10-09. Source files remain private.',createdAt:'2026-10-09T00:00:00Z'}]);
  await upsert(client,'import_batches',[{id:batchId,sourceId:'local-catalog-2018q2',fileHash,country:manifest.country,locales:manifest.locales,extractedAt:manifest.extractedAt,importedAt:new Date().toISOString(),counts:{...counts,referenceAudit}}]);
  await upsert(client,'vehicle_makes',[...maps.make.values()].map(r=>({id:r.id,sourceId:r.id,labels:r.labels,batchId})));
  await upsert(client,'vehicle_models',[...maps.model.values()].map(r=>({id:r.id,sourceId:r.sourceId,kind:r.kind,makeId:r.makeId,labels:r.labels,productionFrom:r.from,productionTo:r.to,partial:!r.labels.en&&!r.labels.ru,batchId})));
  await upsert(client,'vehicle_variants',[...maps.variant.values()].map(r=>({id:r.id,sourceId:r.sourceId,modelId:r.modelId,labels:r.labels,productionFrom:r.from,productionTo:r.to,...canonicalAttributes(r.attributes.en),attributes:r.attributes,batchId})));
  await upsert(client,'part_categories',[...maps.category.values()].map(r=>({id:r.id,sourceId:r.sourceId,parentId:r.parentId,labels:r.labels,batchId})));
  const brands=new Map();for(const p of maps.part.values())brands.set(p.brandId,{id:p.brandId,sourceId:p.brandId,label:p.brand,batchId});await upsert(client,'part_brands',[...brands.values()]);
  await upsert(client,'parts',[...maps.part.values()].map(p=>({id:p.id,sourceId:p.id,brandId:p.brandId,number:p.number,normalizedNumber:normalizeNumber(p.number),labels:p.labels,attributes:p.attributes,batchId})));
  await upsert(client,'part_fitments',[...maps.fitment.values()]);
  const oe=new Map(),crosses=new Map();for(const p of maps.part.values()){
   for(const [position,r] of p.oe.entries()){
    const informationLabels={en:r.information};const translated=p.oeTranslations.ru?.[position];if(translated&&translated.manufacturerId===r.manufacturerId&&translated.number===r.number&&translated.additive===r.additive)informationLabels.ru=translated.information;
    const id=hash(JSON.stringify([p.id,r.manufacturerId,r.number,r.additive,position]));oe.set(id,{id,partId:p.id,manufacturerId:r.manufacturerId,manufacturer:r.manufacturer,number:r.number,normalizedNumber:normalizeNumber(r.number),additive:r.additive,information:r.information,informationLabels,position});
   }
   for(const r of p.crosses){if(!r.number)continue;const id=hash(JSON.stringify([p.id,r.type,r.brand,r.number]));crosses.set(id,{id,partId:p.id,targetNumber:r.number,targetBrand:r.brand,targetSourceId:r.sourceId,relationType:r.type});}
  }
  await upsert(client,'oe_references',[...oe.values()]);await upsert(client,'part_crosses',[...crosses.values()]);
  await client.query('COMMIT');console.log('Committed',envFile,batchId,counts);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
if(process.argv.includes('--fitments'))require('./import-fitments.cjs');
else run().catch(e=>{console.error('Import failed:',e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
