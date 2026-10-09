import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import {config as loadEnv} from 'dotenv';
if(process.env.NODE_ENV!=='production')loadEnv({path:'../../.env'});
const config:NextConfig={transpilePackages:['@selection/api','@selection/core','@selection/db']};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
