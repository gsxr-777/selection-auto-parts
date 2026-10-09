const base=process.argv[2] || 'https://selection-auto-parts.vercel.app';
(async()=>{
  const root=await fetch(base,{redirect:'manual'});
  if(![307,308].includes(root.status)||!root.headers.get('location')?.endsWith('/ru'))throw new Error('Default locale redirect failed');
  console.log('Root redirect: /ru');
  for(const [locale,title] of [['ru','Ваш автомобиль. Его запчасти.'],['en','Your vehicle. Its parts.']]){
    const response=await fetch(base+'/'+locale);const html=await response.text();
    if(!response.ok||!html.includes(title)||!html.includes(`lang="${locale}"`))throw new Error('Localized page failed');
    console.log(locale,'page: HTTP',response.status);
  }
  for(const path of ['/api/v1/health','/api/v1/health/database','/api/v1/vehicles/models?locale=ru']){
    const response=await fetch(base+path);const data=await response.json();
    if(!response.ok)throw new Error('Endpoint failed: '+path);
    if(path.includes('models')&&(data.data?.length!==0||data.status!=='empty'))throw new Error('Catalog is not empty');
    console.log(path,response.status,JSON.stringify(data));
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
