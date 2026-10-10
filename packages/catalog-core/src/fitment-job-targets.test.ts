import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const {jobTargets}=createRequire(import.meta.url)('../../../scripts/fitment-job-targets.cjs');
it('local-only jobs import and verify exclusively the local database',()=>{
 expect(jobTargets('local-only')).toEqual({localOnly:true,imports:[['local','.env',[]]],checks:[['scripts/verify-catalog.cjs','--full','--local-only']]});
});
it('full jobs include production import and live verification',()=>{
 const result=jobTargets('local-and-production');
 expect(result.localOnly).toBe(false);
 expect(result.imports).toContainEqual(['production','.env.production.local',['--production']]);
 expect(result.checks).toContainEqual(['scripts/verify-deployment.cjs']);
});
it('unknown settings fail instead of defaulting to production',()=>{
 expect(()=>jobTargets('local')).toThrow('Unknown fitment job target');
 expect(()=>jobTargets(undefined)).toThrow('Unknown fitment job target');
});
