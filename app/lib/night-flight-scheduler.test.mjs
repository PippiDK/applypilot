import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadScheduler(){
  try{return await import('./night-flight-scheduler.js')}catch{return null}
}

function fakeSupabase({settings=[],runs={}}={}){
  return {
    from(table){
      const filters={}
      const lists={}
      const query={
        select(){return query},
        eq(field,value){filters[field]=value;return query},
        in(field,values){lists[field]=values;return query},
        order(){return query},
        limit(){return query},
        async maybeSingle(){
          if(table!=='night_flight_runs') return {data:null,error:null}
          if(filters.target_date){
            const key=`${filters.user_id}|${filters.target_date}`
            return {data:runs[key]||null,error:null}
          }
          const candidates=Object.entries(runs)
            .filter(([key])=>!filters.user_id||key.startsWith(`${filters.user_id}|`))
            .map(([,row])=>row)
            .filter(row=>!lists.status||lists.status.includes(row.status))
            .sort((a,b)=>String(a?.target_date||'').localeCompare(String(b?.target_date||'')))
          return {data:candidates[0]||null,error:null}
        },
        then(resolve,reject){
          if(table==='night_flight_settings'){
            const data=settings.filter(row=>Object.entries(filters).every(([field,value])=>row[field]===value))
            return Promise.resolve({data,error:null}).then(resolve,reject)
          }
          return Promise.resolve({data:[],error:null}).then(resolve,reject)
        },
      }
      return query
    },
  }
}

test('Task 7 keeps the Copenhagen 02:00 start guard correct across DST',async()=>{
  const mod=await loadScheduler()
  assert.ok(mod,'night-flight-scheduler.js must exist')

  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-01-15T00:00:00.000Z')),false)
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-01-15T01:00:00.000Z')),true)
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-07-15T00:00:00.000Z')),true)

  // Spring-forward: local 02:00 does not exist; 01:00 UTC is 03:00 Copenhagen.
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-03-29T00:00:00.000Z')),false)
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-03-29T01:00:00.000Z')),true)

  // Fall-back: local 02:00 occurs twice; both ticks are eligible and idempotency handles the duplicate.
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-10-25T00:00:00.000Z')),true)
  assert.equal(mod.shouldRunNightFlightTick(new Date('2026-10-25T01:00:00.000Z')),true)
})

test('Task 7 runs only users whose Night Flight setting is enabled',async()=>{
  const mod=await loadScheduler()
  assert.ok(mod,'night-flight-scheduler.js must exist')
  const supabase=fakeSupabase({settings:[
    {user_id:'u1',enabled:true},
    {user_id:'u2',enabled:false},
    {user_id:'u3',enabled:true},
  ]})
  const called=[]
  const result=await mod.runNightFlightScheduler({
    supabase,
    now:new Date('2026-07-15T00:00:00.000Z'),
    runUser:async({userId})=>{called.push(userId);return {status:'RUNNING'}},
  })

  assert.deepEqual(called,['u1','u3'])
  assert.equal(result.usersEligible,2)
  assert.equal(result.usersFailed,0)
})

test('Task 7 skips an existing same-date run before doing fresh discovery again',async()=>{
  const mod=await loadScheduler()
  assert.ok(mod,'night-flight-scheduler.js must exist')
  const supabase=fakeSupabase({runs:{
    'u1|2026-07-14':{id:'run-existing',status:'RUNNING',target_date:'2026-07-14'},
  }})
  let discoveries=0
  let persists=0
  const result=await mod.runNightFlightForUser({
    supabase,
    userId:'u1',
    now:new Date('2026-07-15T00:00:00.000Z'),
    discover:async()=>{discoveries+=1;return {targetDate:'2026-07-14'}},
    persist:async()=>{persists+=1;return {runId:'new'}},
    processMatches:async()=>({runId:'run-existing',status:'RUNNING'}),
  })

  assert.equal(result.runId,'run-existing')
  assert.equal(result.resumed,true)
  assert.equal(discoveries,0)
  assert.equal(persists,0)
})

test('Task 8 processes both resumed and newly created Night Flight runs through the shared Match processor',async()=>{
  const mod=await loadScheduler()
  assert.ok(mod,'night-flight-scheduler.js must exist')
  const resumedSupabase=fakeSupabase({runs:{
    'u1|2026-07-14':{id:'run-existing',status:'RUNNING',target_date:'2026-07-14'},
  }})
  const processed=[]
  const processMatches=async({userId,runId})=>{
    processed.push([userId,runId])
    return {runId,status:'READY',jobsReady:1}
  }

  const resumed=await mod.runNightFlightForUser({
    supabase:resumedSupabase,userId:'u1',now:new Date('2026-07-15T00:00:00.000Z'),processMatches,
  })
  const fresh=await mod.runNightFlightForUser({
    supabase:fakeSupabase(),userId:'u2',now:new Date('2026-07-15T00:00:00.000Z'),
    discover:async()=>({targetDate:'2026-07-14'}),
    persist:async()=>({runId:'run-new',status:'RUNNING'}),
    processMatches,
  })

  assert.deepEqual(processed,[['u1','run-existing'],['u2','run-new']])
  assert.equal(resumed.status,'READY')
  assert.equal(resumed.resumed,true)
  assert.equal(fresh.status,'READY')
  assert.equal(fresh.resumed,false)
})

test('Task 7 isolates one user failure and continues the remaining enabled users',async()=>{
  const mod=await loadScheduler()
  assert.ok(mod,'night-flight-scheduler.js must exist')
  const supabase=fakeSupabase({settings:[
    {user_id:'u1',enabled:true},
    {user_id:'u2',enabled:true},
    {user_id:'u3',enabled:true},
  ]})
  const called=[]
  const result=await mod.runNightFlightScheduler({
    supabase,
    now:new Date('2026-07-15T00:00:00.000Z'),
    runUser:async({userId})=>{
      called.push(userId)
      if(userId==='u2') throw new Error('source failed')
      return {status:'RUNNING'}
    },
  })

  assert.deepEqual(called,['u1','u2','u3'])
  assert.equal(result.usersSucceeded,2)
  assert.equal(result.usersFailed,1)
  assert.match(result.failures[0].error,/source failed/i)
})

test('Task 7 Vercel config uses an hourly UTC resume window with the Copenhagen start guard',async()=>{
  const config=JSON.parse(await readFile(new URL('../../vercel.json',import.meta.url),'utf8'))
  assert.deepEqual(config.crons,[
    {path:'/api/cron/night-flight',schedule:'0 0-6 * * *'},
  ])
})

test('Task 7 cron route is protected by CRON_SECRET and uses server admin Supabase',async()=>{
  let source=''
  try{source=await readFile(new URL('../api/cron/night-flight/route.js',import.meta.url),'utf8')}catch{}
  assert.match(source,/CRON_SECRET/)
  assert.match(source,/authorization/i)
  assert.match(source,/Bearer/)
  assert.match(source,/createAdminSupabaseClient/)
  assert.match(source,/runNightFlightScheduler/)
})
