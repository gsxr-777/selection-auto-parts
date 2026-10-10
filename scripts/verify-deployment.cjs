const base=process.argv[2] || 'https://selection-auto-parts.vercel.app';
(async()=>{
  const root=await fetch(base,{redirect:'manual'});
  if(![307,308].includes(root.status)||!root.headers.get('location')?.endsWith('/ru'))throw new Error('Default locale redirect failed');
  console.log('Root redirect: /ru');
  for(const [locale,title] of [['ru','Ваш автомобиль. Его запчасти.'],['en','Your vehicle. Its parts.']]){
    const response=await fetch(base+'/'+locale);const html=await response.text();
    if(!response.ok||!html.includes(title)||!html.includes(`lang="${locale}"`)||/tecdoc/i.test(html))throw new Error('Localized page failed');
    console.log(locale,'page: HTTP',response.status);
  }
  for(const path of ['/api/v1/health','/api/v1/health/database','/api/v1/vehicles/models?locale=ru']){
    const response=await fetch(base+path);const data=await response.json();
    if(!response.ok)throw new Error('Endpoint failed: '+path);
    console.log(path,response.status,JSON.stringify(data));
  }
  const selection=await (await fetch(base+'/api/v1/vehicles/selection?locale=ru&makeId=36&modelId=car:5454')).json();
  if(!selection.makes?.length||!selection.variants?.some(v=>v.id==='car:18953'&&v.powerKw===74))throw new Error('Imported Focus not found');
  const groups=await (await fetch(base+'/api/v1/parts/categories?locale=ru&variantId=car:18953')).json();
  const group=groups.data?.find(g=>g.hasParts);if(!group)throw new Error('Part groups missing');
  const parts=await (await fetch(base+'/api/v1/parts/by-vehicle?'+new URLSearchParams({locale:'ru',variantId:'car:18953',categoryId:group.id}))).json();
  if(!parts.total||!parts.data?.length)throw new Error('Imported parts missing');
  console.log('Imported selection/groups/parts:',selection.makes.length,groups.data.length,parts.total);
  const pistons=await (await fetch(base+'/api/v1/parts/by-vehicle?locale=ru&variantId=car:18953&categoryId=1:100529')).json();
  const piston=pistons.data?.find(p=>p.brand==='MAHLE ORIGINAL'&&p.number==='015 76 00');
  if(pistons.total!==10||!piston?.oe.some(r=>r.manufacturer==='FORD'&&r.number==='4M 5G 61 05 CC'))throw new Error('Full piston import failed');
  const references=await (await fetch(base+'/api/v1/parts/references?locale=ru&partId=4334:CSL2244&kind=oe&page=2')).json();
  if(references.total!==11501||references.page!==2||references.oe?.length!==20)throw new Error('Reference pagination failed');
  console.log('Full import: 10 pistons; source-backed MAHLE/FORD record verified; 11,501-reference part paginates.');
  const headlights=await (await fetch(base+'/api/v1/parts/by-vehicle?locale=en&variantId=car:18305&categoryId=1:101657')).json();
  const headlight=headlights.data?.find(p=>p.id==='138:32 12 09');
  if(!headlight?.fitmentGroups.some(group=>group.general.some(attribute=>attribute.value==='01.2008')))throw new Error('Expanded Focus 1.4 headlight or source year restriction missing');
  const bulbs=await (await fetch(base+'/api/v1/parts/by-vehicle?locale=en&variantId=car:1394&categoryId=1:101721')).json();
  if(!bulbs.data?.some(p=>p.id==='101:06910'))throw new Error('Expanded Audi bulb fitment missing');
  console.log('Reverse fitment prototype: JOHNS headlight on Focus 1.4 with 01.2008 restriction; FEBI bulb on Audi 80.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
