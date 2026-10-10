const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {StringDecoder}=require('node:string_decoder');
const {createRequire}=require('node:module');
const requireCore=createRequire(path.resolve('packages/catalog-core/package.json'));
const {z}=requireCore('zod');
const attribute=z.object({id:z.string(),title:z.string(),value:z.string()}).strict();
const base={id:z.string().min(1),label:z.string()};
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const vehicle=z.discriminatedUnion('entity',[
 z.object({...base,entity:z.literal('make')}).strict(),
 z.object({...base,entity:z.literal('model'),sourceId:z.string(),makeId:z.string(),kind:z.enum(['car','motorcycle']),from:date,to:date}).strict(),
 z.object({...base,entity:z.literal('variant'),sourceId:z.string(),modelId:z.string(),from:date,to:date,attributes:z.array(attribute)}).strict()
]);
const part=z.discriminatedUnion('entity',[
 z.object({...base,entity:z.literal('category'),sourceId:z.string(),parentId:z.string().nullable(),state:z.string()}).strict(),
 z.object({...base,entity:z.literal('part'),brandId:z.string().min(1),brand:z.string().min(1),number:z.string().min(1),categoryId:z.string(),variantId:z.literal('car:18953'),sequenceId:z.string().min(1),productId:z.string().min(1),attributes:z.array(attribute),conditions:z.array(z.object({general:z.array(attribute),alternatives:z.array(z.array(attribute)),information:z.array(z.string())})),oe:z.array(z.object({manufacturerId:z.string(),manufacturer:z.string(),number:z.string().min(1),additive:z.boolean(),information:z.string()})),crosses:z.array(z.object({type:z.enum(['replaces','replaced_by']),number:z.string(),brand:z.string(),sourceId:z.string().nullable()})),_query:z.string().optional(),_references:z.boolean().optional()}).strict()
]);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifestSchema=z.object({version:z.literal(1),release:z.literal('2/2018'),country:z.literal('RUS'),locales:z.tuple([z.literal('en'),z.literal('ru')]),extractedAt:z.string().refine(v=>Number.isFinite(Date.parse(v)))}).strict();
function loadReferenceManufacturers(directory){
 const manifest=manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'))),maps=[],files=[];
 for(const locale of manifest.locales){
  const file=path.join(directory,`manufacturers-${locale}.jsonl`);
  if(!fs.existsSync(file+'.complete')||fs.readFileSync(file+'.complete','utf8').trim()!==String(fs.statSync(file).size))throw new Error('Reference manufacturer export is incomplete');
  const map=new Map();for(const row of readRows(file,z.object({id:z.string().min(1),label:z.string(),comparison:z.boolean()}).strict())){
   if(map.has(row.id)&&map.get(row.id)!==row.comparison)throw new Error('Conflicting reference manufacturer flags '+row.id);
   map.set(row.id,row.comparison);
  }maps.push(map);files.push(file);
 }
 if(maps[0].size!==maps[1].size||[...maps[0]].some(([id,flag])=>maps[1].get(id)!==flag))throw new Error('Reference manufacturer locale mismatch');
 return {manufacturers:maps[0],fileHash:hash(files.map(file=>hash(fs.readFileSync(file))).join('|')),extractedAt:manifest.extractedAt};
}
function normalizeNumber(value){return value.normalize('NFKC').toUpperCase().replace(/[\s.\-_/]/g,'');}
function canonicalAttributes(attrs){
 const value=title=>attrs.find(a=>a.title===title)?.value||null;
 const numeric=(title,unit)=>{const v=attrs.find(a=>a.title===title&&a.value.endsWith(unit))?.value;return v?Number(v.slice(0,-unit.length).trim()):null;};
 const fuel=value('Fuel type'),engine=value('Engine type'),body=value('Body type'),gear=value('Gear type')||value('Transmission Type')||value('Transmission type')||value('Gear Type');
 const canonicalFuel=/Hybrid/.test(engine||'')||(/Electro|Electric/.test(fuel||'')&&fuel!=='Electric')?'hybrid':engine==='Electric Motor'?'electric':({'Petrol':'petrol','Diesel':'diesel','Electric':'electric','Mixture':'mixture','Alcohol':'alcohol','Petrol/Petroleum Gas (LPG)':'petrol_lpg','Petrol/Natural Gas (CNG)':'petrol_cng','Petrol/Ethanol':'petrol_ethanol','CNG':'cng','LPG':'lpg','Petrol/Ethanol/Natural Gas':'petrol_ethanol_cng','Flexfuel':'flexfuel','Hydrogen':'hydrogen','Petrol/Natural Gas (LNG)':'petrol_lng','Diesel/Natural Gas (CNG)':'diesel_cng'})[fuel]||fuel;
 const canonicalGear=gear==='Manual- / optional automatic transmission'?'manual_automatic':/^Manual Transmission/.test(gear||'')?'manual':/^Automatic Transmission/.test(gear||'')||gear==='Fully Automatic'||gear==='7-Speed dual-clutch transmission'?'automatic':['Variomatic','Plate Link Chain (Stepless)','CVT (Stepless)','CVT'].includes(gear)?'cvt':gear;
 return {fuel:canonicalFuel,
 body:({'Saloon':'sedan','Hatchback':'hatchback','Estate':'estate','Coupe':'coupe','Convertible':'convertible','SUV':'suv','Closed Off-Road Vehicle':'suv','Open Off-Road Vehicle':'open_suv','MPV':'mpv','Van':'van','Pickup':'pickup','Box':'van','Targa':'targa','Platform/Chassis':'chassis','Bus':'bus','Special Design':'special','Box Body / Estate':'box_estate','Hardtop':'hardtop','Box Body / Hatchback':'box_hatchback','Dumptruck':'dumptruck','Cab with engine':'cab_engine','Municipal Vehicle':'municipal','Truck Tractor':'tractor'})[body]||body,
 transmission:canonicalGear,
 powerKw:numeric('Power','kW'),displacementCm3:numeric('Capacity (technic)','ccm'),engineCode:attrs.filter(a=>a.title==='Engine code').map(a=>a.value).join(', ')||null};
}
function* readRows(file,schema){
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1048576),decoder=new StringDecoder('utf8');let pending='',lineNumber=0;
 const parse=line=>{lineNumber++;try{return schema.parse(JSON.parse(line.replace(/^\uFEFF/,'')));}catch{throw new Error(`Invalid source row: ${path.basename(file)}:${lineNumber}`);}};
 try{
  let length;while((length=fs.readSync(fd,buffer,0,buffer.length,null))>0){
   pending+=decoder.write(buffer.subarray(0,length));let newline;
   while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline).replace(/\r$/,'');pending=pending.slice(newline+1);if(line)yield parse(line);else lineNumber++;}
  }
  pending+=decoder.end();if(pending.trim())yield parse(pending.replace(/\r$/,''));
 }finally{fs.closeSync(fd);}
}
function loadCatalog(directory,sample=false,vehiclesOnly=false,parentSample=false){
 if(parentSample&&!sample)throw new Error('Parent-only scope is restricted to sample validation');
 const maps={make:new Map(),model:new Map(),variant:new Map(),category:new Map(),part:new Map(),fitment:new Map()};
 const files=[];
 for(const locale of ['en','ru']){
  const file=path.join(directory,`vehicles-${locale}.jsonl`);files.push(file);
  for(const row of readRows(file,vehicle)){
   let entry=maps[row.entity].get(row.id);if(!entry){entry={...row,labels:{},attributes:{}};maps[row.entity].set(row.id,entry);}
   if(locale==='ru'&&(['sourceId','makeId','modelId','kind','from','to'].some(key=>key in row&&entry[key]!==row[key])))throw new Error('Locale relation mismatch '+row.id);
   entry.labels[locale]=row.label;if(row.attributes)entry.attributes[locale]=row.attributes;
  }
  if(vehiclesOnly)continue;
  const parentFile=path.join(path.dirname(directory),'catalog-parent-export',`parts-${locale}.jsonl`);
  const partFiles=parentSample?[parentFile]:[path.join(directory,`parts-${locale}.jsonl`),parentFile];
  for(const partsFile of partFiles){
   const complete=partsFile+'.complete';
   if(!fs.existsSync(complete)||!fs.existsSync(partsFile)||fs.readFileSync(complete,'utf8').trim()!==String(fs.statSync(partsFile).size))throw new Error('Source pass is incomplete: '+path.basename(path.dirname(partsFile))+'/'+path.basename(partsFile));
   files.push(partsFile);
  for(const row of readRows(partsFile,part)){
   if(row.entity==='category'){
    let entry=maps.category.get(row.id);if(!entry){entry={...row,labels:{}};maps.category.set(row.id,entry);}if(entry.parentId!==row.parentId)throw new Error('Category hierarchy mismatch '+row.id);entry.labels[locale]=row.label;
   }else{
    let entry=maps.part.get(row.id);if(!entry){entry={...row,labels:{},attributes:{},oeTranslations:{}};maps.part.set(row.id,entry);}entry.labels[locale]=row.label;entry.attributes[locale]=row.attributes;if(row._references!==false){entry.oeTranslations[locale]=row.oe;if(locale==='en'){entry.oe=row.oe;entry.crosses=row.crosses;}}
    const id=hash(JSON.stringify([row.variantId,row.id,row.categoryId,row.productId,row.sequenceId]));
    let fitment=maps.fitment.get(id);if(!fitment){fitment={id,partId:row.id,categoryId:row.categoryId,variantId:row.variantId,attributes:{sourceSequenceId:row.sequenceId,sourceProductId:row.productId}};maps.fitment.set(id,fitment);}fitment.attributes[locale]={label:row.label,attributes:row.attributes,conditions:row.conditions};
   }
  }
  }
 }
 for(const model of maps.model.values())if(!maps.make.has(model.makeId))throw new Error('Missing make '+model.id);
 for(const variant of maps.variant.values())if(!maps.model.has(variant.modelId))throw new Error('Missing model '+variant.id);
 for(const category of maps.category.values()){
  if(category.parentId&&!maps.category.has(category.parentId))throw new Error('Missing parent '+category.id);
  if(!('en' in category.labels)||!('ru' in category.labels))throw new Error('Incomplete category locales '+category.id);
 }
 for(const p of maps.part.values())if(!('en' in p.labels)||!('ru' in p.labels)||!('en' in p.oeTranslations)||!('ru' in p.oeTranslations))throw new Error('Incomplete part locales or references '+p.id);
 for(const fitment of maps.fitment.values())if(!maps.part.has(fitment.partId)||!maps.category.has(fitment.categoryId)||!maps.variant.has(fitment.variantId)||!fitment.attributes.en||!fitment.attributes.ru)throw new Error('Incomplete fitment '+fitment.id);
 const focus=maps.variant.get('car:18953');if(!focus||canonicalAttributes(focus.attributes.en).powerKw!==74||focus.from!=='2005-04-01'||focus.to!=='2012-09-30'||!maps.model.get(focus.modelId).labels.en.includes('DB_'))throw new Error('Focus identity mismatch');
 if(sample){
  const model=maps.model.get(focus.modelId),make=maps.make.get(model.makeId);maps.variant=new Map([[focus.id,focus]]);maps.model=new Map([[model.id,model]]);maps.make=new Map([[make.id,make]]);
  const selected=new Set(),perRoot=new Map();for(const f of maps.fitment.values()){let c=maps.category.get(f.categoryId);while(c.parentId)c=maps.category.get(c.parentId);const count=perRoot.get(c.id)||0;if(count<3&&!selected.has(f.partId)){selected.add(f.partId);perRoot.set(c.id,count+1);}}
  maps.part=new Map([...maps.part].filter(([id])=>selected.has(id)));maps.fitment=new Map([...maps.fitment].filter(([,f])=>selected.has(f.partId)));
 }
 const manifest=manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8')));
 let referenceAudit=null;
 if(!vehiclesOnly){
  const {manufacturers,fileHash,extractedAt}=loadReferenceManufacturers(path.join(path.dirname(directory),'catalog-reference-export'));let checkedOe=0;
  for(const p of maps.part.values())for(const reference of p.oe){
   if(!manufacturers.has(reference.manufacturerId))throw new Error('Unknown reference manufacturer '+reference.manufacturerId);
   if(manufacturers.get(reference.manufacturerId))throw new Error('Comparison number cannot be imported as OE: '+p.id);
   checkedOe++;
  }
  referenceAudit={fileHash,extractedAt,manufacturerCount:manufacturers.size,checkedOe};
 }
 if(!sample&&(maps.make.size!==596||maps.model.size!==13174||maps.variant.size!==75843))throw new Error('Full vehicle counts differ from the verified source census');
 const fileHash=hash(files.map(file=>hash(fs.readFileSync(file))).join('|'));
 return {maps,manifest,fileHash,referenceAudit,counts:Object.fromEntries(Object.entries(maps).map(([key,value])=>[key,value.size]))};
}
module.exports={loadCatalog,canonicalAttributes,normalizeNumber,hash,readRows};
