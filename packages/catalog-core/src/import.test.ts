import {createRequire} from 'node:module';
import {it,expect} from 'vitest';
import {selectionQuerySchema,partsQuerySchema,modelsQuerySchema} from './index';
const {canonicalAttributes,normalizeNumber}=createRequire(import.meta.url)('../../../scripts/catalog-data.cjs');
it('only normalizes known source values, preserves missing gearbox and engine codes',()=>{
 const values=canonicalAttributes([{title:'Fuel type',value:'Petrol/Electric'},{title:'Body type',value:'Saloon'},{title:'Power',value:'74 kW'},{title:'Capacity (technic)',value:'1596 ccm'},{title:'Engine code',value:'HWDA'},{title:'Engine code',value:'SHDA'}]);
 expect(values).toMatchObject({fuel:'hybrid',body:'sedan',powerKw:74,displacementCm3:1596,engineCode:'HWDA, SHDA',transmission:null});
 expect(canonicalAttributes([{title:'Fuel type',value:'Electric'}]).fuel).toBe('electric');
 expect(canonicalAttributes([{title:'Transmission Type',value:'Unknown special type'}]).transmission).toBe('Unknown special type');
});
it('preserves OE characters while normalizing punctuation and width',()=>{expect(normalizeNumber('5M51 F406A10-AB')).toBe('5M51F406A10AB');expect(normalizeNumber('АБ-１２')).toBe('АБ12');});
it('requires parents, bounds pages and favorites lookup at API boundaries',()=>{
 expect(selectionQuerySchema.safeParse({modelId:'car:1'}).success).toBe(false);expect(selectionQuerySchema.safeParse({fuel:'petrol'}).success).toBe(false);
 expect(partsQuerySchema.safeParse({variantId:'car:1',categoryId:'1:2',limit:51}).success).toBe(false);expect(partsQuerySchema.safeParse({variantId:'car:1',categoryId:'1:2',page:0}).success).toBe(false);
 expect(modelsQuerySchema.safeParse({ids:Array.from({length:101},(_,i)=>String(i)).join(',')}).success).toBe(false);
});
