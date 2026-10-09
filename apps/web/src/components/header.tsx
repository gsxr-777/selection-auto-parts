'use client';
import {useLocale,useTranslations} from 'next-intl';
import {usePathname,useRouter,Link} from '@/i18n/navigation';
import {useSyncExternalStore} from 'react';
import {locales,type Locale} from '@selection/core';
function subscribe(listener:()=>void){const media=window.matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',listener);window.addEventListener('themechange',listener);return()=>{media.removeEventListener('change',listener);window.removeEventListener('themechange',listener);};}
function isDark(){const theme=document.documentElement.dataset.theme;return theme==='dark'||(theme==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);}
export default function Header(){
  const t=useTranslations('common');const locale=useLocale();const router=useRouter();const pathname=usePathname();
  const targetLocale=locales[(Math.max(0,locales.indexOf(locale as Locale))+1)%locales.length];
  const languageName=new Intl.DisplayNames([targetLocale],{type:'language'}).of(targetLocale)||targetLocale;
  const targetLanguage=languageName.charAt(0).toLocaleUpperCase(targetLocale)+languageName.slice(1);
  const dark=useSyncExternalStore(subscribe,isDark,()=>false);
  return <header className="header glass"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">◈</span>{t('brand')}</Link><div className="switches"><button className="language-switch" aria-label={t('language')} onClick={()=>{router.replace(pathname+window.location.search+window.location.hash,{locale:targetLocale});}}>{targetLanguage}</button><button className="theme-switch" aria-label={t('theme')} onClick={()=>{const theme=isDark()?'light':'dark';document.documentElement.dataset.theme=theme;document.cookie=`theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;window.dispatchEvent(new Event('themechange'));}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>}</svg></button></div></header>;
}
