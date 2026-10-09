const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');
const requireDb=createRequire(path.resolve('packages/db/package.json'));const {Client}=requireDb('pg');const dotenv=requireDb('dotenv');
(async()=>{for(const name of process.argv.includes('--local-only')?['.env']:['.env','.env.production.local']){
 const env=dotenv.parse(fs.readFileSync(name));const db=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});await db.connect();try{
  const {rows:[counts]}=await db.query(`SELECT (SELECT count(*)::int FROM vehicle_makes) AS makes,(SELECT count(*)::int FROM vehicle_models WHERE kind='car') AS car_models,(SELECT count(*)::int FROM vehicle_models WHERE kind='motorcycle') AS motorcycle_models,(SELECT count(*)::int FROM vehicle_variants WHERE id LIKE 'car:%') AS car_variants,(SELECT count(*)::int FROM vehicle_variants WHERE id LIKE 'motorcycle:%') AS motorcycle_variants,(SELECT count(*)::int FROM part_categories) AS categories,(SELECT count(*)::int FROM parts) AS parts,(SELECT count(*)::int FROM part_fitments) AS fitments,(SELECT count(*)::int FROM oe_references) AS oe,(SELECT count(*)::int FROM part_crosses) AS replacements,pg_size_pretty(pg_database_size(current_database())) AS database_size`);
  const {rows:[focus]}=await db.query('SELECT id, "modelId", "powerKw", fuel, body, transmission FROM vehicle_variants WHERE id=$1',['car:18953']);
  if(!focus||focus.powerKw!==74||focus.modelId!=='car:5454'||focus.fuel!=='petrol'||focus.body!=='sedan'||focus.transmission!==null)throw new Error('Focus mismatch');
  if(!counts.parts||!counts.categories||!counts.fitments)throw new Error('Missing part data');
  if(process.argv.includes('--full')){
   const expected={makes:596,car_models:11631,motorcycle_models:1543,car_variants:68339,motorcycle_variants:7504,categories:1152,parts:11305,fitments:26571,oe:733224,replacements:682};
   for(const [key,value] of Object.entries(expected))if(counts[key]!==value)throw new Error('Full import count mismatch: '+key);
   const {rows:[batch]}=await db.query(`SELECT counts FROM import_batches WHERE id=$1`,['catalog-2018q2-full-2eb226b1ceba5293']);
   if(batch?.counts.referenceAudit?.checkedOe!==733224||batch.counts.referenceAudit.manufacturerCount!==3507||!batch.counts.referenceAudit.fileHash)throw new Error('Missing reference classification audit');
  }
  const {rows:[invalid]}=await db.query(`SELECT count(*)::int AS total FROM part_fitments WHERE "variantId"<>$1`,['car:18953']);if(invalid.total)throw new Error('Unexpected vehicle fitment');
  const {rows:[blank]}=await db.query(`SELECT count(*)::int AS total FROM vehicle_models WHERE NOT partial AND coalesce(labels->>'ru', '')='' AND coalesce(labels->>'en', '')=''`);if(blank.total)throw new Error('Unmarked empty labels');
  console.log(name,counts,'Focus validated; no unrelated fitment or unmarked empty label.');
 }finally{await db.end();}
}})().catch(error=>{console.error('Catalog verification failed:',error.message);process.exitCode=1;});
