'use client';
import {useEffect,useRef,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {referencesResultSchema,type PartResults} from '@selection/core';
export default function PartReferences({part,kind}:{part:PartResults['data'][number];kind:'oe'|'crosses'}){
 const t=useTranslations('common'),locale=useLocale();
 const [rows,setRows]=useState({oe:part.oe,crosses:part.crosses}),[page,setPage]=useState(1),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const total=kind==='oe'?(part.oeTotal??part.oe.length):(part.crossesTotal??part.crosses.length),pages=Math.ceil(total/20);
 async function change(next:number){
  controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);setError(false);
  try{const response=await fetch('/api/v1/parts/references?'+new URLSearchParams({locale,partId:part.id,kind,page:String(next)}),{signal:request.signal});if(!response.ok)throw new Error();const result=referencesResultSchema.parse(await response.json());setRows(result);setPage(next);}
  catch{if(!request.signal.aborted)setError(true);}
  finally{if(!request.signal.aborted)setLoading(false);}
 }
 return <div className={kind==='oe'?'oe-block':'cross-block'} aria-busy={loading}>
  <span className="result-label">{t(kind==='oe'?'originalReferences':'confirmedCrosses')}</span>
  <ul>{kind==='oe'?rows.oe.map((oe,i)=><li key={i}><span>{oe.manufacturer}</span><code>{oe.number}</code>{oe.information&&<small>{oe.information}</small>}{oe.additive&&<small>{t('additiveOe')}</small>}</li>):rows.crosses.map((c,i)=><li key={i}><small>{t(c.type==='replaces'?'replaces':'replacedBy')}</small><span>{c.brand}</span><code>{c.number}</code></li>)}</ul>
  {error&&<p role="alert">{t('error')}</p>}
  {pages>1&&<nav className="pagination" aria-label={t(kind==='oe'?'oePagination':'crossPagination')}><button disabled={loading||page===1} onClick={()=>void change(page-1)}>{t('previous')}</button><span>{t('pageOf',{page,total:pages})}</span><button disabled={loading||page===pages} onClick={()=>void change(page+1)}>{t('next')}</button></nav>}
 </div>;
}
