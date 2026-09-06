import test from 'node:test'
import assert from 'node:assert/strict'
import {persistNightFlightAreaScope} from './night-flight-area-scope.js'

function fakeSupabase(){
  const calls=[]
  return {
    calls,
    from(table){
      return {
        select(){return this},
        eq(){return this},
        async maybeSingle(){return {data:null,error:null}},
        insert(rows){
          calls.push({table,rows})
          if(table==='night_flight_runs'){
            return {select(){return this},async single(){return {data:{id:'run-source-test'},error:null}}}
          }
          return Promise.resolve({data:null,error:null})
        },
      }
    },
  }
}

test('Night Flight canonicalizes LinkedIn Jobs provenance before DB persistence',async()=>{
  const supabase=fakeSupabase()
  const batch={
    targetDate:'2026-09-04',
    profileFingerprint:'profile-source-test',
    searchProfileSnapshot:{unionSearchPlan:{directions:[{role:'Senior Project Manager'}]}},
    cvTextSnapshot:'Frozen CV text long enough for the source persistence regression test.',
    cvSourceVersion:'cv-source-test',
    sourcesSnapshot:['linkedin'],
    areasSnapshot:[],
    frozenAt:'2026-09-05T10:00:00.000Z',
    jobs:[{
      job:{
        source:'LinkedIn Jobs',
        sourceJobId:'123456789',
        title:'Senior Project Manager',
        company:'Acme',
        location:'Copenhagen, Denmark',
        publishedAt:'2026-09-04T09:00:00.000Z',
        description:'Verified full job description',
      },
      nightFlightSources:['linkedin'],
    }],
  }

  await persistNightFlightAreaScope({supabase,userId:'user-source-test',batch})
  const jobsInsert=supabase.calls.find(call=>call.table==='night_flight_jobs')
  assert.ok(jobsInsert)
  assert.equal(jobsInsert.rows[0].source,'linkedin')
  assert.equal(jobsInsert.rows[0].job_key,'linkedin:123456789')
})
