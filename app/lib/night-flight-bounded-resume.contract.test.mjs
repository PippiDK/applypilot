import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {readFile} from 'node:fs/promises'

function fakeExistingRunSupabase(){
  return {
    from(table){
      assert.equal(table,'night_flight_runs')
      const query={
        select(){return query},
        eq(){return query},
        async maybeSingle(){return {data:{id:'run-existing',status:'RUNNING',target_date:'2026-07-14'},error:null}},
      }
      return query
    },
  }
}

test('Night Flight bounds each scheduled user run to two Match jobs',async()=>{
  const mod=await import('./night-flight-scheduler.js')
  let processInput=null
  await mod.runNightFlightForUser({
    supabase:fakeExistingRunSupabase(),
    userId:'u1',
    now:new Date('2026-07-15T00:00:00.000Z'),
    processMatches:async input=>{processInput=input;return {runId:'run-existing',status:'RUNNING'}},
  })
  assert.equal(processInput?.maxJobs,2)
})

test('Night Flight Match processor forwards the scheduler batch limit to the durable queue',()=>{
  const source=fs.readFileSync(new URL('./night-flight-match-processor.js',import.meta.url),'utf8')
  assert.match(source,/maxJobs/)
  assert.match(source,/processQueue\(\{[\s\S]*?maxJobs[\s\S]*?\}\)/)
})

test('Vercel schedules hourly resume ticks through the overnight recovery window',async()=>{
  const config=JSON.parse(await readFile(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.deepEqual(config.crons,[
    {path:'/api/cron/night-flight',schedule:'0 0-6 * * *'},
  ])
})

test('RUNNING Morning Review is labelled in progress instead of completed',()=>{
  const component=fs.readFileSync(new URL('../components/night-flight-morning-review.js',import.meta.url),'utf8')
  assert.match(component,/const dayLabel=activeRun\?'In progress':'Last completed day'/)
  assert.ok((component.match(/\{dayLabel\} ·/g)||[]).length>=2)
})

test('unfinished Night Flight jobs keep their real queue status instead of being shown as FAILED',()=>{
  const component=fs.readFileSync(new URL('../components/night-flight-morning-review.js',import.meta.url),'utf8')
  assert.match(component,/jobStatusClass/)
  assert.match(component,/jobStatusLabel/)
  assert.doesNotMatch(component,/\{item\.status==='READY'\?'READY':'FAILED'\}/)
})
