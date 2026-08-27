import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateProfilePrecheck,semanticInputForCandidate,applySemanticProfileMatch} from './linkedin-profile-evaluator.js'

const now=new Date('2026-08-27T12:00:00Z')
const job={
  title:'Senior Project Manager',
  description:'Lead enterprise platform modernization and integrations.',
  publishedAt:'2026-08-27T08:00:00Z',
  vacancyStatus:'OPEN',
  company:'Example'
}
const candidate={
  jobId:'1',
  foundBy:[{key:'it-pm',role:'Senior IT Project Manager',tier:'primary'},{key:'impl',role:'Implementation Manager',tier:'adjacent'}]
}

test('blank exclusions do not create hidden domain rejects',()=>{
  const result=evaluateProfilePrecheck({job,freshnessDays:7,exclusionRules:[],now})
  assert.equal(result.pass,true)
})

test('explicit deterministic exclusion still rejects',()=>{
  const result=evaluateProfilePrecheck({
    job:{...job,company:'Blocked Co'},freshnessDays:7,now,
    exclusionRules:[{category:'company',operator:'exclude',value:'Blocked Co',evaluation:'deterministic',originalText:'no Blocked Co'}]
  })
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_EXCLUSION_REJECT')
})

test('semantic input contains full JD and every foundBy direction without taxonomy',()=>{
  const input=semanticInputForCandidate({candidate,job})
  assert.equal(input.jobId,'1')
  assert.equal(input.description,job.description)
  assert.deepEqual(input.directions.map(x=>x.role),['Senior IT Project Manager','Implementation Manager'])
})

test('semantic compatible result becomes KEEP and preserves existing score scale',()=>{
  const outcome=applySemanticProfileMatch({
    candidate,job,
    semantic:{jobId:'1',compatible:true,directionKey:'it-pm',score:88,reason:'IT project delivery matches.'}
  })
  assert.equal(outcome.keep,true)
  assert.equal(outcome.decision,'KEEP')
  assert.equal(outcome.evaluation.breakdown.roleDirection,'Senior IT Project Manager')
  assert.equal(outcome.evaluation.breakdown.tier,'primary')
  assert.equal(outcome.evaluation.breakdown.semanticCompatibility,88)
  assert.equal(outcome.evaluation.score,9.4)
})

test('semantic mismatch becomes PROFILE_ROLE_REJECT without domain language',()=>{
  const outcome=applySemanticProfileMatch({
    candidate,job,
    semantic:{jobId:'1',compatible:false,directionKey:'',score:18,reason:'Civil construction work is materially different from the requested IT project role.'}
  })
  assert.equal(outcome.keep,false)
  assert.equal(outcome.stage,'PROFILE_ROLE_REJECT')
  assert.equal(outcome.decision,'REJECT')
  assert.doesNotMatch(outcome.reason,/TARGET_TECH|delivery domain|NON_TARGET/i)
})

test('unknown profession is not rejected by local taxonomy',()=>{
  const artistCandidate={jobId:'a1',foundBy:[{key:'artist',role:'Concept Artist',tier:'primary'}]}
  const artistJob={...job,title:'Senior Concept Artist',description:'Visual development and character concept art.'}
  const outcome=applySemanticProfileMatch({
    candidate:artistCandidate,job:artistJob,
    semantic:{jobId:'a1',compatible:true,directionKey:'artist',score:95,reason:'Direct concept-art work.'}
  })
  assert.equal(outcome.keep,true)
})
