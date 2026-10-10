import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const {resolveOriginalFitments}=createRequire(import.meta.url)('../../../scripts/fitment-identity.cjs');
const content={label:'Fixture bellow',attributes:[],conditions:[{general:[{id:'position',title:'Position',value:'Left'}],alternatives:[],information:[]}]};
const row=(id:string,sequence:string,variantId='car:18953')=>({id,partId:'fixture:1',variantId,categoryId:'1:fixture',attributes:{sourceProductId:'fixture-product',sourceSequenceId:sequence,en:content,ru:content}});
const resolve=(incoming:ReturnType<typeof row>[],existing:ReturnType<typeof row>[])=>resolveOriginalFitments(new Map(incoming.map(r=>[r.id,r])),existing,'car:18953',['en','ru']);
it('preserves original identity and sequence when reverse enumeration differs',()=>{
 const original=row('original','4'),result=resolve([row('reverse','1')],[original]);
 expect([...result.keys()]).toEqual(['original']);
 expect(result.get('original').attributes).toMatchObject({sourceSequenceId:'4',sourceReverseSequenceIds:['1'],en:content,ru:content});
 expect(original.attributes).not.toHaveProperty('sourceReverseSequenceIds');
});
it('matches content before a conflicting enumeration key',()=>{
 const conflicting=row('reverse','1');conflicting.attributes.en={...content,label:'Another fixture linkage'};
 const result=resolve([row('reverse','1')],[conflicting,row('original','4')]);
 expect([...result.keys()]).toEqual(['original']);
});
it('rejects different conditions, products, categories and missing locale content',()=>{
 const original=row('original','4');
 const changed=row('reverse','1');changed.attributes.ru={...content,conditions:[]};
 expect(()=>resolve([changed],[original])).toThrow('no equivalent original');
 for(const modified of [{...original,categoryId:'1:other'},{...original,attributes:{...original.attributes,sourceProductId:'other'}},{...original,attributes:{...original.attributes,ru:undefined}}]){
  expect(()=>resolveOriginalFitments(new Map([['reverse',row('reverse','1')]]),[modified],'car:18953',['en','ru'])).toThrow('no equivalent original');
 }
});
it('coalesces identical reverse rows while retaining their source sequence numbers',()=>{
 const result=resolve([row('reverse-1','1'),row('reverse-2','2')],[row('original','4')]);
 expect(result.size).toBe(1);expect(result.get('original').attributes.sourceReverseSequenceIds).toEqual(['1','2']);
});
it('keeps other exact vehicles independent and repeat resolution idempotent',()=>{
 const target=row('target','1','car:2');expect(resolve([target],[]).get('target')).toEqual(target);
 const incoming=[row('reverse','1')],first=resolve(incoming,[row('original','4')]);
 expect(resolve(incoming,[...first.values()])).toEqual(first);
});
