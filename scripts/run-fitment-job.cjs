// Long-running, resumable host-side continuation of the owner-authorized fitment import.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{createRequire}=require('node:module');
const {isDeepStrictEqual}=require('node:util'),{hash}=require('./catalog-data.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.cache/catalog-fitment-export');
const statusFile=path.join(directory,'job-status.json'),lockFile=path.join(directory,'job.lock');
if(process.argv.includes('--status')){console.log(fs.existsSync(statusFile)?fs.readFileSync(statusFile,'utf8'):'No fitment job status');process.exit(0);}
const requireDb=createRequire(path.join(root,'packages/db/package.json')),{Client}=requireDb('pg'),dotenv=requireDb('dotenv');
let locked=false,stage='starting',state={},log;
const redact=value=>String(value).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]');
const identities=parts=>parts.map(({id,brandId,number})=>({id,brandId,number})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
function update(values){state={...state,...values,stage,pid:process.pid,updatedAt:new Date().toISOString()};const temporary=statusFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(state,null,2));fs.renameSync(temporary,statusFile);}
function note(message){log.write(new Date().toISOString()+' '+redact(message)+'\n');}
function sourceProgress(){
 const file=path.join(directory,'progress.txt');if(!fs.existsSync(file))return {};
 const descriptor=fs.openSync(file,'r');
 try{const {size,mtime}=fs.fstatSync(descriptor),buffer=Buffer.alloc(Math.min(4096,size));fs.readSync(descriptor,buffer,0,buffer.length,size-buffer.length);return {sourceUpdatedAt:mtime.toISOString(),sourceProgress:buffer.toString('utf8').trim().split(/\r?\n/).at(-1)||'Initializing catalog reader'};}
 finally{fs.closeSync(descriptor);}
}
async function database(envFile){
 const env=dotenv.parse(fs.readFileSync(path.join(root,envFile))),client=new Client({connectionString:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL});
 try{
  await client.connect();
  const inventory=(await client.query(`SELECT (SELECT count(*) FROM parts)::text AS parts,(SELECT count(*) FROM oe_references)::text AS oe,(SELECT count(*) FROM part_crosses)::text AS replacements,(SELECT count(*) FROM vehicle_makes)::text AS makes,(SELECT count(*) FROM vehicle_models)::text AS models,(SELECT count(*) FROM vehicle_variants)::text AS variants`)).rows[0];
  const parts=(await client.query('SELECT p.id,p."brandId",p.number FROM parts p WHERE EXISTS (SELECT 1 FROM part_fitments f WHERE f."partId"=p.id AND f."variantId"=$1) ORDER BY p.id',['car:18953'])).rows;
  const fitments=(await client.query('SELECT count(*)::text AS count FROM part_fitments')).rows[0].count;
  return {inventory,parts:identities(parts),fitments};
 }finally{await client.end();}
}
async function command(args){
 note('node '+args.join(' '));
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>log.write(redact(data)));child.stderr.on('data',data=>log.write(redact(data)));
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(args[0]+' exited '+code)));
 });
}
async function run(){
 fs.mkdirSync(directory,{recursive:true});
 try{fs.writeFileSync(lockFile,String(process.pid),{flag:'wx'});}catch(error){
  if(error.code!=='EEXIST')throw error;
  const previous=Number(fs.readFileSync(lockFile,'utf8'));if(!Number.isSafeInteger(previous)||previous<1)throw new Error('Invalid job lock; inspect it before resuming');
  try{process.kill(previous,0);throw new Error('Another fitment job is running: '+previous);}catch(check){if(check.code!=='ESRCH')throw check;}
  fs.unlinkSync(lockFile);fs.writeFileSync(lockFile,String(process.pid),{flag:'wx'});
 }
 locked=true;
 log=fs.createWriteStream(path.join(directory,'job.log'),{flags:'a'});
 const planText=fs.readFileSync(path.join(directory,'plan.json'),'utf8'),plan=JSON.parse(planText),planHash=hash(planText);
 if(plan.scope!=='existing-parts'||plan.sourceVariantId!=='car:18953'||plan.parts.some(p=>p.variantIds!==null))throw new Error('The job requires the unrestricted existing-parts Focus plan');
 const planned=identities(plan.parts);
 const baselineFile=path.join(directory,'job-baseline.json');
 let baseline;
 if(fs.existsSync(baselineFile)){
  baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));if(baseline.planHash!==planHash)throw new Error('Job baseline belongs to a different plan');
 }else{
  const local=await database('.env'),production=await database('.env.production.local');
  if(!isDeepStrictEqual(local.parts,planned)||!isDeepStrictEqual(production.parts,planned))throw new Error('Plan differs from the previously imported Focus parts');
  baseline={planHash,createdAt:new Date().toISOString(),local,production};fs.writeFileSync(baselineFile,JSON.stringify(baseline));
 }
 stage='exporting';update({planHash,parts:plan.parts.length,startedAt:new Date().toISOString(),baseline:baseline.local.inventory});note('Waiting for the complete EN/RU source export');
 while(!fs.existsSync(path.join(directory,'export.complete.json'))){
  if(hash(fs.readFileSync(path.join(directory,'plan.json'),'utf8'))!==planHash)throw new Error('Export plan changed during the job');
  const exitFile=path.join(directory,'exit.txt');
  if(fs.existsSync(exitFile))throw new Error('Export stopped before completion: '+fs.readFileSync(exitFile,'utf8').replace(/\0/g,'').trim());
  const names=fs.readdirSync(directory),done=names.filter(name=>name.endsWith('.done.json'));
  update({completedPartLocales:done.length,totalPartLocales:plan.parts.length*2,completedChunks:names.filter(name=>name.endsWith('.jsonl.complete')).length,...sourceProgress()});
  await new Promise(resolve=>setTimeout(resolve,15000));
 }
 if(JSON.parse(fs.readFileSync(path.join(directory,'export.complete.json'),'utf8')).planHash!==planHash)throw new Error('Completed export belongs to a different plan');
 stage='validating-export';update({});await command(['scripts/import-catalog.cjs','--fitments','--validate']);
 for(const [name,envFile,extra] of [['local','.env',[]],['production','.env.production.local',['--production']]]){
  const before=await database(envFile);
  if(!isDeepStrictEqual(before.inventory,baseline[name].inventory)||!isDeepStrictEqual(before.parts,planned))throw new Error(name+' catalog inventory changed since job preparation');
  stage='importing-'+name;update({});await command(['scripts/import-catalog.cjs','--fitments',...extra]);
  const after=await database(envFile);
  if(!isDeepStrictEqual(after.inventory,baseline[name].inventory)||!isDeepStrictEqual(after.parts,planned))throw new Error(name+' inventory changed during the relationship-only import');
  update({[name]:{inventory:after.inventory,fitmentsBefore:baseline[name].fitments,fitmentsAfter:after.fitments}});
 }
 stage='verifying';update({});await command(['scripts/verify-catalog.cjs','--full']);await command(['scripts/verify-deployment.cjs']);
 if(state.local.fitmentsAfter!==state.production.fitmentsAfter)throw new Error('Local and production fitment counts differ');
 stage='complete';update({completedAt:new Date().toISOString()});note('Complete: local, production and live deployment verified; part/OE/replacement inventory unchanged');
}
run().catch(error=>{stage='failed';if(locked){update({error:redact(error.message)});if(log)note(error.stack);}console.error(redact(error.message));process.exitCode=1;}).finally(()=>{if(locked)fs.unlinkSync(lockFile);if(log)log.end();});
