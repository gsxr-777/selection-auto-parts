import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
export default async function NotFound(){const t=await getTranslations('common');return <main className="glass panel"><h1>{t('notFound')}</h1><Link href="/">{t('home')}</Link></main>;}
