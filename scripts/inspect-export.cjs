const fs=require('node:fs');
const records=fs.readFileSync('.cache/catalog-export/vehicles-en.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const counts={};for(const r of records)if(r.entity==='variant')for(const a of r.attributes)if(/Fuel type|Engine type|Body type|Gear|Transmission/.test(a.title)){counts[a.title]??={};counts[a.title][a.value]=(counts[a.title][a.value]||0)+1;}
console.log(JSON.stringify(counts,null,2));
