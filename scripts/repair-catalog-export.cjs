// Repair only this project's private scratch export while its VM helper is stopped.
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const {once}=require('node:events');
async function run(){
 const name=process.argv[2]||'catalog-export';
 if(!['catalog-export','catalog-parent-export'].includes(name))throw new Error('Unknown scratch export');
 const folder=path.resolve('.cache',name);
 for(const locale of ['en','ru']){
  const file=path.join(folder,`parts-${locale}.jsonl`);if(!fs.existsSync(file))continue;
  const ids=suffix=>new Set(fs.existsSync(path.join(folder,`${suffix}-${locale}.txt`))?fs.readFileSync(path.join(folder,`${suffix}-${locale}.txt`),'utf8').trim().split(/\r?\n/):[]);
  const nodes=ids('completed'),queries=ids('queries'),partIds=new Set(),categoryIds=new Set();let count=0;
  const clean=file+'.repair.tmp',output=fs.createWriteStream(clean,{highWaterMark:1048576});
  const lines=readline.createInterface({input:fs.createReadStream(file,{highWaterMark:1048576}),crlfDelay:Infinity});
  let incompleteTail=false;
  for await(const line of lines){
   if(!line.trim())continue;if(incompleteTail)throw new Error('Invalid row inside export; repair stopped');
   let row;try{row=JSON.parse(line.replace(/^\uFEFF/,''));}catch{incompleteTail=true;continue;}
   const keep=row.entity==='category'?!categoryIds.has(row.id):nodes.has(row.categoryId)||queries.has(row._query);
   if(!keep)continue;
   if(row.entity==='category')categoryIds.add(row.id);else{count++;partIds.add(row.id);}
   if(!output.write(line+'\n'))await once(output,'drain');
  }
  output.end();await once(output,'finish');
  fs.copyFileSync(file,file+'.previous');fs.renameSync(clean,file);
  fs.writeFileSync(file+'.checkpoint.json',JSON.stringify({length:fs.statSync(file).size,count,partIds:[...partIds],categoryIds:[...categoryIds]}));
  console.log(name,locale,{count,uniqueParts:partIds.size,categories:categoryIds.size,incompleteTail});
 }
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
