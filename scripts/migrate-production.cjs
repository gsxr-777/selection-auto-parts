const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');const {spawnSync}=require('node:child_process');
const requireDb=createRequire(path.resolve('packages/db/package.json'));const env=requireDb('dotenv').parse(fs.readFileSync('.env.production.local'));
const result=spawnSync(process.execPath,[path.resolve('packages/db/node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:path.resolve('packages/db'),env:{...process.env,...env},stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
