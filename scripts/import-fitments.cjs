const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireDb=createRequire(path.resolve('packages/db/package.json'));
const {Client}=requireDb('pg'),dotenv=requireDb('dotenv');
const {loadFitments}=require('./fitment-data.cjs'),{upsert}=require('./catalog-db.cjs');
const {resolveOriginalFitments}=require('./fitment-identity.cjs');
async function run(){
 const args=process.argv.slice(2),directoryIndex=args.indexOf('--directory');
 if(directoryIndex>=0&&(!args[directoryIndex+1]||args[directoryIndex+1].startsWith('--')))throw new Error('Missing --directory value');
 const directory=path.resolve(directoryIndex>=0?args[directoryIndex+1]:'.cache/catalog-fitment-export');
 const data=loadFitments(directory,{retainFitments:false}),{plan,manifest,fileHash,categories,audits,counts,variantIds}=data;
 if((plan.scope==='sample')!==args.includes('--sample'))throw new Error('Specify --sample only for a sample export; a sample must never be reported as a full import');
 if(args.includes('--validate')){console.log({scope:plan.scope,counts,fileHash,auditedParts:audits.length});return;}
 const envFile=args.includes('--production')?'.env.production.local':'.env',env=dotenv.parse(fs.readFileSync(envFile));
 const client=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});
 const batchId='catalog-2018q2-fitments-'+plan.scope+'-'+fileHash.slice(0,16);
 try{
  await client.connect();await client.query('BEGIN');
  const inventorySql='SELECT (SELECT count(*) FROM parts)::text AS parts,(SELECT count(*) FROM oe_references)::text AS oe,(SELECT count(*) FROM part_crosses)::text AS replacements,(SELECT count(*) FROM part_fitments WHERE "variantId"=$1)::text AS originalFitments';
  const inventoryBefore=(await client.query(inventorySql,[plan.sourceVariantId])).rows[0];
  const ids=plan.parts.map(p=>p.id);
  const planned=new Map(plan.parts.map(p=>[p.id,p]));
  const existing=(await client.query('SELECT id,"brandId",number FROM parts WHERE id=ANY($1::text[])',[ids])).rows;
  if(existing.length!==ids.length||existing.some(p=>{const w=planned.get(p.id);return !w||w.brandId!==p.brandId||w.number!==p.number;}))throw new Error('Imported part identity differs from the export plan');
  if((await client.query('SELECT DISTINCT "partId" FROM part_fitments WHERE "variantId"=$1 AND "partId"=ANY($2::text[])',[plan.sourceVariantId,ids])).rowCount!==ids.length)throw new Error('Export includes parts outside the original Focus import');
  if((await client.query('SELECT id FROM vehicle_variants WHERE id=ANY($1::text[])',[variantIds])).rowCount!==variantIds.length)throw new Error('Unknown target vehicle variants');
  const categoryIds=[...categories.keys()];
  for(const row of (await client.query('SELECT id,"sourceId","parentId",labels FROM part_categories WHERE id=ANY($1::text[])',[categoryIds])).rows){
   const expected=categories.get(row.id);if(row.sourceId!==expected.sourceId||row.parentId!==expected.parentId||Object.entries(expected.labels).some(([locale,label])=>row.labels[locale]!==label))throw new Error('Existing source category mismatch '+row.id);
  }
  await upsert(client,'import_batches',[{id:batchId,sourceId:'local-catalog-2018q2',fileHash,country:manifest.country,locales:manifest.locales,extractedAt:manifest.extractedAt,importedAt:new Date().toISOString(),counts:{...counts,scope:plan.scope,method:manifest.method,relation:manifest.relation,planHash:manifest.planHash,audits}}]);
  await upsert(client,'part_categories',[...categories.values()].map(c=>({...c,batchId})));
  let processed=0;
  for(const {fitments} of data.chunks()){
   const focusParts=[...new Set([...fitments.values()].filter(f=>f.variantId===plan.sourceVariantId).map(f=>f.partId))];
   const originals=focusParts.length?(await client.query('SELECT id,"partId","variantId","categoryId",attributes FROM part_fitments WHERE "variantId"=$1 AND "partId"=ANY($2::text[])',[plan.sourceVariantId,focusParts])).rows:[];
   const resolved=resolveOriginalFitments(fitments,originals,plan.sourceVariantId,plan.locales);
   for(const row of (await client.query('SELECT id,attributes FROM part_fitments WHERE id=ANY($1::text[])',[[...resolved.keys()]])).rows){
    const expected=resolved.get(row.id).attributes;
    const {isDeepStrictEqual}=require('node:util');
    for(const locale of plan.locales)if(!isDeepStrictEqual(row.attributes[locale],expected[locale]))throw new Error('Existing exact linkage differs from reverse export '+row.id);
   }
   await upsert(client,'part_fitments',[...resolved.values()].map(f=>({...f,attributes:{...f.attributes,importProvenance:{batchId,sourceId:'local-catalog-2018q2',release:manifest.release,country:manifest.country,method:manifest.method,relation:manifest.relation}}})));
   processed+=fitments.size;
   if(processed%10000<fitments.size)console.log('Fitments processed',processed,'/',counts.fitments);
  }
  const inventoryAfter=(await client.query(inventorySql,[plan.sourceVariantId])).rows[0];
  if(!require('node:util').isDeepStrictEqual(inventoryBefore,inventoryAfter))throw new Error('Relationship-only import changed parts, OE references, replacements or original Focus fitments');
  await client.query('COMMIT');console.log('Committed',envFile,batchId,counts);
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
}
run().catch(error=>{console.error('Fitment import failed:',error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
