import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule(){
  try{return await import('./night-flight-area-scope.js')}catch{return null}
}

const item=(id,location,source='linkedin')=>({
  job:{
    jobId:`${source}:${id}`,
    sourceJobId:id,
    source,
    title:`Role ${id}`,
    company:'Acme',
    location,
    publishedAt:'2026-09-04T10:00:00.000Z',
    fullJd:'Full JD',
    sourceRecords:[{source,sourceJobId:id}],
  },
  evaluation:{score:80},
  nightFlightSources:[source],
})

const batch=areasSnapshot=>Object.freeze({
  targetDate:'2026-09-04',
  profileFingerprint:'profile-fp-5',
  searchProfileSnapshot:Object.freeze({unionSearchPlan:{directions:[{role:'Senior Project Manager'}]}}),
  cvTextSnapshot:'Frozen CV text for Task 8',
  cvSourceVersion:'cv-v5',
  sourcesSnapshot:Object.freeze(['linkedin','jobindex']),
  areasSnapshot:Object.freeze([...areasSnapshot]),
  jobs:Object.freeze([
    item('cph','Nærum, Denmark'),
    item('aarhus','Aarhus, Denmark','jobindex'),
    item('unknown','Denmark'),
  ]),
  frozenAt:'2026-09-05T02:00:00.000Z',
})

function fakeSupabase({existingRun=null}={}){
  const calls=[]
  return {
    calls,
    from(table){
      return {
        select(){return this},
        eq(){return this},
        async maybeSingle(){
          calls.push({table,op:'select-existing'})
          return {data:table==='night_flight_runs'?existingRun:null,error:null}
        },
        insert(rows){
          calls.push({table,op:'insert',rows})
          if(table==='night_flight_runs'){
            return {
              select(){return this},
              async single(){return {data:{id:'run-5'},error:null}},
            }
          }
          return Promise.resolve({data:null,error:null})
        },
      }
    },
  }
}

test('Task 5 keeps every discovered vacancy and queues ALL when no areas are selected',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const planned=mod.planNightFlightAreaScope(batch([]))

  assert.equal(planned.length,3)
  assert.deepEqual(planned.map(row=>row.status),['QUEUED','QUEUED','QUEUED'])
  assert.deepEqual(planned.map(row=>row.area),['copenhagen_north','aarhus_east_jutland',null])
})

test('Task 5 queues only selected areas and marks every other discovered vacancy SKIPPED_AREA',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const planned=mod.planNightFlightAreaScope(batch(['copenhagen_north']))

  assert.equal(planned.length,3,'area scope must not filter discovery/history')
  assert.deepEqual(planned.map(row=>row.status),['QUEUED','SKIPPED_AREA','SKIPPED_AREA'])
  assert.equal(planned[1].job.job.sourceJobId,'aarhus')
  assert.equal(planned[2].job.job.sourceJobId,'unknown')
})

test('Task 5 uses the existing ApplyPilot geography semantics',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const planned=mod.planNightFlightAreaScope(Object.freeze({...batch(['greater_copenhagen','north_zealand']),jobs:Object.freeze([
    item('ballerup','Ballerup, Denmark'),
    item('hillerod','Hillerød, Denmark'),
    item('odense','Odense, Denmark'),
  ])}))

  assert.deepEqual(planned.map(row=>row.area),['greater_copenhagen','north_zealand','funen'])
  assert.deepEqual(planned.map(row=>row.status),['QUEUED','QUEUED','SKIPPED_AREA'])
})

test('Task 5 persists one run plus ALL discovered jobs with initial area-scope states',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const supabase=fakeSupabase()
  const frozen=batch(['copenhagen_north'])
  const result=await mod.persistNightFlightAreaScope({supabase,userId:'user-5',batch:frozen})

  const runCall=supabase.calls.find(call=>call.table==='night_flight_runs'&&call.op==='insert')
  const jobsCall=supabase.calls.find(call=>call.table==='night_flight_jobs'&&call.op==='insert')
  assert.ok(runCall)
  assert.ok(jobsCall)
  assert.equal(runCall.rows.user_id,'user-5')
  assert.equal(runCall.rows.target_date,'2026-09-04')
  assert.equal(runCall.rows.profile_fingerprint,'profile-fp-5')
  assert.deepEqual(runCall.rows.search_profile_snapshot,frozen.searchProfileSnapshot)
  assert.equal(runCall.rows.cv_text_snapshot,frozen.cvTextSnapshot)
  assert.equal(runCall.rows.cv_source_version,'cv-v5')
  assert.equal(runCall.rows.jobs_discovered,3)
  assert.equal(runCall.rows.jobs_queued,1)
  assert.equal(runCall.rows.jobs_skipped,2)
  assert.equal(runCall.rows.status,'RUNNING')

  assert.equal(jobsCall.rows.length,3,'every discovered vacancy must be persisted')
  assert.deepEqual(jobsCall.rows.map(row=>row.status),['QUEUED','SKIPPED_AREA','SKIPPED_AREA'])
  assert.deepEqual(jobsCall.rows.map(row=>row.area),['copenhagen_north','aarhus_east_jutland',null])
  assert.ok(jobsCall.rows.every(row=>row.run_id==='run-5'))
  assert.equal(result.jobsDiscovered,3)
  assert.equal(result.jobsQueued,1)
  assert.equal(result.jobsSkipped,2)
})

test('Task 6 repeated invocation for the same user/date resumes the existing run without resetting its batch',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const existingRun={
    id:'run-existing',
    jobs_discovered:3,
    jobs_queued:1,
    jobs_skipped:2,
    status:'RUNNING',
  }
  const supabase=fakeSupabase({existingRun})

  const result=await mod.persistNightFlightAreaScope({supabase,userId:'user-5',batch:batch(['copenhagen_north'])})

  assert.equal(result.runId,'run-existing')
  assert.equal(result.jobsDiscovered,3)
  assert.equal(result.jobsQueued,1)
  assert.equal(result.jobsSkipped,2)
  assert.equal(supabase.calls.some(call=>call.op==='insert'),false,'resume must not insert or reset the existing run/jobs')
})

test('Task 5 does not mutate the frozen Task 4 discovery batch',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-area-scope.js must exist')
  const frozen=batch(['copenhagen_north'])
  const before=JSON.stringify(frozen)
  mod.planNightFlightAreaScope(frozen)
  assert.equal(JSON.stringify(frozen),before)
  assert.equal(Object.isFrozen(frozen.jobs),true)
  assert.equal(frozen.jobs[0].status,undefined)
})