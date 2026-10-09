const fs=require('node:fs');
const {createRequire}=require('node:module');
const requireDb=createRequire(process.cwd()+'/packages/db/package.json');
const {Client}=requireDb('pg');
const dotenv=requireDb('dotenv');
(async()=>{
  for(const name of ['.env','.env.production.local']) {
    if(!fs.existsSync(name))continue;
    const env=dotenv.parse(fs.readFileSync(name));
    const client=new Client({connectionString:env.DATABASE_URL_UNPOOLED || env.DATABASE_URL});
    await client.connect();
    const {rows}=await client.query("SELECT current_database() AS database, current_user AS role, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables");
    console.log(name,rows[0]);
    await client.end();
  }
})().catch(()=>{console.error('Database verification failed; credentials omitted.');process.exitCode=1;});
