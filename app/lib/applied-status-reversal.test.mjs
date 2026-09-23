import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {archiveAppliedJob,removeAppliedJob} from './applied-jobs.js'
import {removeAppliedJobFromSupabase} from './applied-jobs-supabase-store.js'
import {deleteAppliedJob} from './applied-jobs-client.js'

const item=(jobId)=>({jobId,title:'Project Manager '+jobId,company:'Example',appliedAt:'2026-09-23T10:00:00Z'})
const archive=[item('a'),item('b'),item('c')]

test('revoke APPLIED removes only the specified job without altering other application records',()=>{
  const result=removeAppliedJob({archive,jobId:'b'})
  assert.deepEqual(result.map(job=>job.jobId),['a','c'])
  assert.equal(result[0].appliedAt,archive[0].appliedAt)
  assert.deepEqual(removeAppliedJob({archive:result,jobId:'b'}).map(job=>job.jobId),['a','c'])
  assert.deepEqual(removeAppliedJob({archive:result,jobId:''}).map(job=>job.jobId),['a','c'])
  assert.deepEqual(archive.map(job=>job.jobId),['a','b','c'])
  assert.deepEqual(archiveAppliedJob({archive:result,job:{sourceJobId:'b',title:'Reapplied',company:'Example'}}).map(x=>x.jobId),['b','a','c'])
})

test('Supabase removal is scoped to authenticated user and exact job ID',async()=>{
  const filters=[]
  const client={from(table){
    assert.equal(table,'applied_jobs')
    return {delete(){return {
      eq(column,value){
        filters.push([column,value])
        return this
      },
      then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}
    }}}
  }}
  assert.equal(await removeAppliedJobFromSupabase({supabase:client,userId:'user-1',jobId:'b'}),true)
  assert.deepEqual(filters,[['user_id','user-1'],['job_id','b']])
})

test('Supabase removal rejects failed writes instead of silently hiding an archive entry',async()=>{
  const client={from(){return {delete(){return {
    eq(){return this},
    then(resolve,reject){return Promise.resolve({error:{message:'storage unavailable'}}).then(resolve,reject)}
  }}}}}
  await assert.rejects(removeAppliedJobFromSupabase({supabase:client,userId:'user-1',jobId:'b'}),error=>error?.message==='storage unavailable')
})

test('client DELETE submits only job identity and honors returned canonical archive',async()=>{
  const requested=[]
  const result=await deleteAppliedJob('b',{fetchImpl:async(url,options)=>{
    requested.push([url,options.method,JSON.parse(options.body)])
    return {ok:true,json:async()=>({jobs:[item('a'),item('c')]})}
  }})
  assert.deepEqual(requested,[['/api/applied-jobs','DELETE',{jobId:'b'}]])
  assert.deepEqual(result.map(job=>job.jobId),['a','c'])
})

test('status change removes the job from both the local view and durable archive, without editing other statuses',()=>{
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  const route=readFileSync(new URL('../api/applied-jobs/route.js',import.meta.url),'utf8')
  assert.match(main,/status!=='applied'\s*&&\s*appliedJobsRef\.current\.some\(/)
  assert.match(main,/removeAppliedJob\(\{archive:appliedJobsRef\.current,jobId\}\)/)
  assert.match(main,/deleteAppliedJob\(removeJobId\)/)
  assert.match(main,/archiveWriteQueue\.current\.then\(/)
  assert.match(route,/export async function DELETE\(request\)/)
  assert.match(route,/removeAppliedJobFromSupabase\(\{supabase:context\.supabase,userId:context\.userId,jobId\}\)/)
  assert.match(route,/loadAppliedJobsFromSupabase\(/)
  assert.doesNotMatch(route,/\.delete\(\)\.neq\(/)
})
