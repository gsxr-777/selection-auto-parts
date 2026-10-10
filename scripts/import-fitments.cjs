const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireDb=createRequire(path.resolve('packages/db/package.json'));
const {Client}=requireDb('pg'),dotenv=requireDb('dotenv');
const {loadFitments}=require('./fitment-data.cjs'),{upsert}=require('./catalog-db.cjs');
async function run(){
 const args=process.argv.slice(2),directoryIndex=args.indexOf('--directory');
 if(directoryIndex>=0&&(!args[directoryIndex+1]||args[directoryIndex+1].startsWith('--')))throw new Error('Missing --directory value');
 const directory=path.resolve(directoryIndex>=0?args[directoryIndex+1]:'.cache/catalog-fitment-export');
 const data=loadFitments(directory,{retainFitments:false}),{plan,manifest,fileHash,categories,audits,counts,variantIds}=data;
 if((plan.scope==='sample')!==args.includes('--sample'))throw new Error('Specify --sample only for a sample export; a sample must never be reported as a full import');
 if(args.includes('--validate')){console.log({scope:plan.scope,counts,fileHash,audits});return;}
 const envFile=args.includes('--production')?'.env.production.local':'.env',env=dotenv.parse(fs.readFileSync(envFile));
 const client=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});
 const batchId='catalog-2018q2-fitments-'+plan.scope+'-'+fileHash.slice(0,16);
 try{
  await client.connect();await client.query('BEGIN');
  const ids=plan.parts.map(p=>p.id);
  const existing=(await client.query('SELECT id,"brandId",number FROM parts WHERE id=ANY($1::text[])',[ids])).rows;
  if(existing.length!==ids.length||existing.some(p=>!plan.parts.some(w=>w.id===p.id&&w.brandId===p.brandId&&w.number===p.number)))throw new Error('Imported part identity differs from the export plan');
  if((await client.query('SELECT id FROM vehicle_variants WHERE id=ANY($1::text[])',[variantIds])).rowCount!==variantIds.length)throw new Error('Unknown target vehicle variants');
  const categoryIds=[...categories.keys()];
  for(const row of (await client.query('SELECT id,"sourceId","parentId",labels FROM part_categories WHERE id=ANY($1::text[])',[categoryIds])).rows){
   const expected=categories.get(row.id);if(row.sourceId!==expected.sourceId||row.parentId!==expected.parentId||Object.entries(expected.labels).some(([locale,label])=>row.labels[locale]!==label))throw new Error('Existing source category mismatch '+row.id);
  }
  await upsert(client,'import_batches',[{id:batchId,sourceId:'local-catalog-2018q2',fileHash,country:manifest.country,locales:manifest.locales,extractedAt:manifest.extractedAt,importedAt:new Date().toISOString(),counts:{...counts,scope:plan.scope,method:manifest.method,relation:manifest.relation,planHash:manifest.planHash,audits}}]);
  await upsert(client,'part_categories',[...categories.values()].map(c=>({...c,batchId})));
  for(const {fitments} of data.chunks()){
   for(const row of (await client.query('SELECT id,attributes FROM part_fitments WHERE id=ANY($1::text[])',[[...fitments.keys()]])).rows){
    const expected=fitments.get(row.id).attributes;
    const {isDeepStrictEqual}=require('node:util');
    for(const locale of plan.locales)if(!isDeepStrictEqual(row.attributes[locale],expected[locale]))throw new Error('Existing exact linkage differs from reverse export '+row.id);
   }
   await upsert(client,'part_fitments',[...fitments.values()].map(f=>({...f,attributes:{...f.attributes,importProvenance:{batchId,sourceId:'local-catalog-2018q2',release:manifest.release,country:manifest.country,method:manifest.method,relation:manifest.relation}}})));
  }
  await client.query('COMMIT');console.log('Committed',envFile,batchId,counts);
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
}
run().catch(error=>{console.error('Fitment import failed:',error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
