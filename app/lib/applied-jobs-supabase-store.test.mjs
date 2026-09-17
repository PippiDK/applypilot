import test from 'node:test'
import assert from 'node:assert/strict'
import {loadAppliedJobsFromSupabase,upsertAppliedJobsToSupabase} from './applied-jobs-supabase-store.js'

function fakeSupabase({rows=[]}={}){
  const calls={upsert:null,select:null}
  const client={
    from(table){
      assert.equal(table,'applied_jobs')
      return {
        upsert(payload,options){
          calls.upsert={payload,options}
          return Promise.resolve({error:null})
        },
        select(columns){
          calls.select=columns
          return {
            eq(column,value){
              assert.equal(column,'user_id')
              assert.equal(value,'11111111-1111-1111-1111-111111111111')
              return {
                order(field,options){
                  assert.equal(field,'applied_at')
                  assert.deepEqual(options,{ascending:false})
                  return Promise.resolve({data:rows,error:null})
                }
              }
            }
          }
        }
      }
    }
  }
  return {client,calls}
}

const userId='11111111-1111-1111-1111-111111111111'

test('upserts existing applied archive without deleting or expiring entries',async()=>{
  const {client,calls}=fakeSupabase()
  await upsertAppliedJobsToSupabase({
    supabase:client,
    userId,
    jobs:[{
      jobId:'123',
      title:'Senior IT Project Manager',
      company:'Ambu',
      location:'Ballerup',
      source:'LinkedIn',
      originalUrl:'https://linkedin.com/jobs/view/123',
      publishedAt:'2026-09-01',
      appliedAt:'2026-09-03T10:00:00.000Z',
      relevanceScore:9.1,
    }]
  })

  assert.equal(calls.upsert.payload.length,1)
  assert.deepEqual(calls.upsert.options,{onConflict:'user_id,job_id'})
  assert.equal(calls.upsert.payload[0].user_id,userId)
  assert.equal(calls.upsert.payload[0].job_id,'123')
  assert.equal(calls.upsert.payload[0].applied_at,'2026-09-03T10:00:00.000Z')
})

test('loads Supabase rows in the existing Applied History shape',async()=>{
  const {client}=fakeSupabase({rows:[{
    user_id:userId,
    job_id:'123',
    title:'Senior IT Project Manager',
    company:'Ambu',
    location:'Ballerup',
    source:'LinkedIn',
    original_url:'https://linkedin.com/jobs/view/123',
    published_at:'2026-09-01',
    applied_at:'2026-09-03T10:00:00.000Z',
    relevance_score:9.1,
  }]})

  const jobs=await loadAppliedJobsFromSupabase({supabase:client,userId})
  assert.deepEqual(jobs,[{
    jobId:'123',
    title:'Senior IT Project Manager',
    company:'Ambu',
    location:'Ballerup',
    source:'LinkedIn',
    originalUrl:'https://linkedin.com/jobs/view/123',
    publishedAt:'2026-09-01',
    appliedAt:'2026-09-03T10:00:00.000Z',
    relevanceScore:9.1,
  }])
})
