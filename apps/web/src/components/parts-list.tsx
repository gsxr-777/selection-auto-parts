'use client';
import {useLocale,useTranslations} from 'next-intl';
import type {PartResults} from '@selection/core';
import PartReferences from './part-references';
export default function PartsList({data}:{data:PartResults['data']}){
 const t=useTranslations('common'),locale=useLocale();
 const attributes=(items:{title:string;value:string}[])=><dl>{items.map((c,i)=><div key={i}><dt>{c.title}</dt><dd>{c.value}</dd></div>)}</dl>;
 return data.map(p=><article className="part-result" key={p.id}>
  <h4>{p.label}</h4>
  {p.oe.length?<PartReferences key={'oe:'+locale+':'+p.id} part={p} kind="oe"/>:<p className="field-hint">{t('noOriginal')}</p>}
  <div className="aftermarket-row"><span className="result-label">{t('aftermarket')}</span><strong>{p.brand}</strong><code>{p.number}</code></div>
  {p.crosses.length>0&&<PartReferences key={'crosses:'+locale+':'+p.id} part={p} kind="crosses"/>}
  {(p.conditions.length>0||p.fitmentGroups.length>0)&&<details><summary>{t('conditions')}</summary>{attributes(p.conditions)}{p.fitmentGroups.map((group,i)=><section className="fitment-condition" key={i}><h5>{t('fitmentCase',{index:i+1})}</h5>{attributes(group.general)}{group.alternatives.length>0&&<><p>{t('fitmentAlternatives')}</p>{group.alternatives.map((block,j)=><div className="fitment-alternative" key={j}><span>{t('alternative',{index:j+1})}</span>{attributes(block)}</div>)}</>}{group.information.map((info,j)=><p key={j}>{info}</p>)}</section>)}</details>}
 </article>);
}
