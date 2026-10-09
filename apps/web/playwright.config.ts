import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://localhost:3000'},webServer:{command:'pnpm start',url:'http://localhost:3000/ru',reuseExistingServer:!process.env.CI,timeout:120000},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
