const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireDb=createRequire(path.resolve('packages/db/package.json'));
const {Client}=requireDb('pg'),dotenv=requireDb('dotenv');
const {hash}=require('./catalog-data.cjs');
async function run(){
 const sample=process.argv.includes('--sample'),directory=path.resolve('.cache/catalog-fitment-export');
 const env=dotenv.parse(fs.readFileSync('.env')),client=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});
 try{
  await client.connect();
  const parts=(await client.query('SELECT p.id,p."brandId",p.number FROM parts p WHERE EXISTS (SELECT 1 FROM part_fitments f WHERE f."partId"=p.id AND f."variantId"=$1) ORDER BY p.id',['car:18953'])).rows;
  const variants=(await client.query('SELECT v.id,m."makeId" FROM vehicle_variants v JOIN vehicle_models m ON m.id=v."modelId" ORDER BY v.id')).rows;
  const selected=sample?parts.filter(p=>['101:06910','138:32 12 09'].includes(p.id)):parts;
  if(!selected.length||(sample&&selected.length!==2))throw new Error('Source-backed parts for the requested scope are missing');
  let sampleIds;
  if(sample){
   const targets=fs.readFileSync('.cache/catalog-fitment-probe/targets-101.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line)).filter(r=>r.area==='PassengerCar'&&r.via==='CurrentArticle');
   const available=new Map(variants.map(v=>[v.id,v])),makes=new Set(),ids=['car:18953'];
   for(const row of targets){const id='car:'+row.id,variant=available.get(id);if(variant&&!makes.has(variant.makeId)){makes.add(variant.makeId);ids.push(id);}if(makes.size===8)break;}
   sampleIds=[...new Set(ids)];
  }
  const plan={version:1,release:'2/2018',country:'RUS',locales:['en','ru'],scope:sample?'sample':'existing-parts',sourceVariantId:'car:18953',variantIds:variants.map(v=>v.id),parts:selected.map(p=>({...p,variantIds:sample&&p.id==='101:06910'?sampleIds:null}))};
  const text=JSON.stringify(plan),file=path.join(directory,'plan.json');fs.mkdirSync(directory,{recursive:true});
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==text)throw new Error('Export directory contains a different plan; archive it before preparing another scope');
  fs.writeFileSync(file,text);console.log({scope:plan.scope,parts:selected.length,variants:variants.length,planHash:hash(text),sampleBulbVariants:sampleIds});
 }finally{await client.end();}
}
run().catch(error=>{console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
