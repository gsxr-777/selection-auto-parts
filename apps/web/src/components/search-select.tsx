'use client';
import {useEffect,useId,useRef,useState} from 'react';
export default function SearchSelect({label,value,options,onChange,disabled,placeholder}:{label:string;value:string;options:{id:string;label:string}[];onChange:(id:string)=>void;disabled?:boolean;placeholder:string}){
 const id=useId();const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [active,setActive]=useState(0);
 const visible=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));const selected=options.find(o=>o.id===value);const activeOption=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)activeOption.current?.scrollIntoView({block:'nearest'});},[open,active,query]);
 function choose(next:string){onChange(next);setOpen(false);setQuery('');}
 return <div className="select-field"><label htmlFor={id}>{label}</label><div className="select-wrap"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open&&visible[active]?`${id}-${active}`:undefined} autoComplete="off" disabled={disabled} placeholder={placeholder} value={open?query:selected?.label||''} onFocus={()=>{setQuery('');setActive(0);setOpen(true);}} onBlur={()=>setOpen(false)} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}} onKeyDown={e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(current=>Math.max(0,Math.min(visible.length-1,current+(e.key==='ArrowDown'?1:-1))));}
  if(e.key==='Enter'&&open){e.preventDefault();if(visible[active])choose(visible[active].id);}
  if(open&&(e.key==='Home'||e.key==='End')&&!query){e.preventDefault();setActive(e.key==='Home'?0:Math.max(0,visible.length-1));}
  if(e.key==='Escape')setOpen(false);
 }}/><span className="select-chevron" aria-hidden="true">⌄</span>{open&&<div id={`${id}-options`} className="select-options" role="listbox" aria-label={label}>{visible.map((o,i)=><button type="button" role="option" ref={i===active?activeOption:undefined} id={`${id}-${i}`} aria-selected={o.id===value} className={i===active?'option-active':''} key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o.id)}>{o.label}</button>)}</div>}</div></div>;
}
