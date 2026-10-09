import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider,hasLocale} from 'next-intl';
import {getTranslations,setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import Header from '@/components/header';
import '../globals.css';
import '../catalog.css';
export function generateStaticParams(){return routing.locales.map(locale=>({locale}));}
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
  const {locale}=await params;
  if(!hasLocale(routing.locales,locale))notFound();
  const t=await getTranslations({locale,namespace:'common'});
  const base=process.env.NEXT_PUBLIC_SITE_URL || 'https://selection-auto-parts.vercel.app';
  return {metadataBase:new URL(base),title:t('brand'),description:t('description'),alternates:{canonical:`/${locale}`,languages:{ru:'/ru',en:'/en','x-default':'/ru'}},openGraph:{title:t('brand'),description:t('description'),locale:locale==='ru'?'ru_RU':'en_US'}};
}
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
  const {locale}=await params;if(!hasLocale(routing.locales,locale))notFound();setRequestLocale(locale);
  const theme=(await cookies()).get('theme')?.value;
  return <html lang={locale} data-theme={theme==='light'||theme==='dark'?theme:'auto'} suppressHydrationWarning><body><NextIntlClientProvider><Header/>{children}</NextIntlClientProvider></body></html>;
}
