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
})().catch(error=>{console.error(error.message);process.exitCode=1;});
