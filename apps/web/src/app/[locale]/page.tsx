import {getTranslations,setRequestLocale} from 'next-intl/server';
import Catalog from '@/components/catalog';
import {Suspense} from 'react';
export default async function Home({params}:{params:Promise<{locale:string}>}){const {locale}=await params;setRequestLocale(locale);const t=await getTranslations('common');return <main><section className="hero"><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p className="intro">{t('intro')}</p></section><Suspense fallback={<p role="status">{t('loading')}</p>}><Catalog/></Suspense><footer>{t('sourceNotice')}</footer></main>;}
