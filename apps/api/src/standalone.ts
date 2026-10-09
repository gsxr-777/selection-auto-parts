import {config} from 'dotenv';
config({path:'../../.env'});
const {app}=await import('./server');
await app.listen({host:'127.0.0.1',port:Number(process.env.API_PORT || 3002)});
