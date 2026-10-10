function jobTargets(target){
 if(!['local-only','local-and-production'].includes(target))throw new Error('Unknown fitment job target');
 const localOnly=target==='local-only';
 return {
  localOnly,
  imports:localOnly?[['local','.env',[]]]:[['local','.env',[]],['production','.env.production.local',['--production']]],
  checks:localOnly?[['scripts/verify-catalog.cjs','--full','--local-only']]:[['scripts/verify-catalog.cjs','--full'],['scripts/verify-deployment.cjs']]
 };
}
module.exports={jobTargets};
