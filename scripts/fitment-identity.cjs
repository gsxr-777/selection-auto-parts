const {isDeepStrictEqual}=require('node:util');
// The native forward and reverse APIs can enumerate identical linkages with
// different SequenceID values. Keep the original Focus identity only when all
// source-backed localized content and the exact vehicle/product/category agree.
function resolveOriginalFitments(fitments,originalRows,sourceVariantId,locales){
 const key=row=>JSON.stringify([row.variantId,row.partId,row.categoryId,row.attributes.sourceProductId]);
 const groups=new Map(),result=new Map();
 for(const row of originalRows){const k=key(row),group=groups.get(k)||[];group.push(row);groups.set(k,group);}
 for(const group of groups.values())group.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 for(const fitment of fitments.values()){
  if(fitment.variantId!==sourceVariantId){result.set(fitment.id,fitment);continue;}
  const equivalent=(groups.get(key(fitment))||[]).filter(row=>locales.every(locale=>isDeepStrictEqual(row.attributes[locale],fitment.attributes[locale])));
  const original=equivalent.find(row=>row.id===fitment.id)||equivalent[0];
  if(!original)throw new Error('Reverse Focus linkage has no equivalent original localized conditions: '+fitment.partId+' '+fitment.categoryId);
  const previous=result.get(original.id),sequences=[...(previous?.attributes.sourceReverseSequenceIds||[]),fitment.attributes.sourceSequenceId];
  result.set(original.id,{...fitment,id:original.id,attributes:{...original.attributes,sourceReverseSequenceIds:[...new Set(sequences)].sort()}});
 }
 return result;
}
module.exports={resolveOriginalFitments};
