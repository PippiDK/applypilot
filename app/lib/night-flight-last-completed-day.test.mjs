import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule(){
  try{return await import('./night-flight-last-completed-day.js')}catch{return null}
}

function fakeSupabase({profileRow,settingsRow}={}){
  return {
    from(table){
      const row=table==='night_flight_profiles'?profileRow:table==='night_flight_settings'?settingsRow:null
      return {
        select(){return this},
        eq(){return this},
        async maybeSingle(){return {data:row??null,error:null}},
      }
    },
  }
}

function profileRow(){
  return {
    user_id:'user-1',
    search_profile:{
      unionSearchPlan:{directions:[{tier:'primary',role:'Senior Project Manager',query:'Senior Project Manager'}]},
      exclusionRules:[{type:'title',value:'intern'}],
    },
    cv_text:'CV text',
    cv_source_version:'cv-v2',
    profile_fingerprint:'profile-fp-2',
    synced_at:'2026-09-05T17:00:00.000Z',
    updated_at:'2026-09-05T17:00:00.000Z',
  }
}

function settingsRow(sources=['linkedin','jobindex','jobnet']){
  return {enabled:true,sources,areas:['copenhagen_north'],updated_at:'2026-09-05T18:00:00.000Z'}
}

function item({source,id,title='Senior Project Manager',company='Acme',location='Copenhagen',publishedAt,fullJd='Full JD'}={}){
  return {
    job:{
      jobId:`${source}:${id}`,
      sourceJobId:id,
      source,
      title,
      company,
      location,
      publishedAt,
      postedDate:publishedAt,
      fullJd,
      description:fullJd,
      sourceRecords:[{source,sourceJobId:id,fullJd}],
    },
    evaluation:{score:80},
  }
}

test('Task 4 derives the exact last completed Copenhagen calendar day',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-last-completed-day.js must exist')
  assert.equal(mod.lastCompletedCopenhagenDate(new Date('2026-03-29T00:30:00.000Z')),'2026-03-28')
  assert.equal(mod.lastCompletedCopenhagenDate(new Date('2026-10-25T02:30:00.000Z')),'2026-10-24')
})

test('Task 4 calls only selected sources and performs a fresh discovery on every run',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-last-completed-day.js must exist')
  const calls=[]
  const sourceRunners={
    linkedin:async input=>{calls.push(['linkedin',input]);return {jobs:[]}},
    jobindex:async input=>{calls.push(['jobindex',input]);return {jobs:[]}},
    jobnet:async input=>{calls.push(['jobnet',input]);return {jobs:[]}},
  }
  const supabase=fakeSupabase({profileRow:profileRow(),settingsRow:settingsRow(['linkedin','jobnet'])})
  const args={supabase,userId:'user-1',now:new Date('2026-09-05T10:00:00.000Z'),sourceRunners}

  await mod.runNightFlightLastCompletedDayDiscovery(args)
  await mod.runNightFlightLastCompletedDayDiscovery(args)

  assert.deepEqual(calls.map(([source])=>source),['linkedin','jobnet','linkedin','jobnet'])
  for(const [,input] of calls){
    assert.equal(input.freshnessDays,3,'Previous Day discovery must use the existing wider request window before exact filtering')
    assert.equal(input.profile.profile_fingerprint,'profile-fp-2')
    assert.equal(input.searchProfile.unionSearchPlan.directions[0].role,'Senior Project Manager')
  }
})

test('Task 4 filters every source to exact Previous Day in Copenhagen before merge',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-last-completed-day.js must exist')
  const now=new Date('2026-09-05T10:00:00.000Z')
  const sourceRunners={
    linkedin:async()=>({jobs:[
      item({source:'linkedin',id:'keep-1',publishedAt:'2026-09-04T12:00:00.000Z'}),
      item({source:'linkedin',id:'keep-2',company:'Beta',publishedAt:'2026-09-03T22:30:00.000Z'}),
      item({source:'linkedin',id:'today',publishedAt:'2026-09-05T00:30:00.000Z'}),
      item({source:'linkedin',id:'old',publishedAt:'2026-09-03T12:00:00.000Z'}),
    ]}),
  }
  const supabase=fakeSupabase({profileRow:profileRow(),settingsRow:settingsRow(['linkedin'])})
  const batch=await mod.runNightFlightLastCompletedDayDiscovery({supabase,userId:'user-1',now,sourceRunners})

  assert.equal(batch.targetDate,'2026-09-04')
  assert.deepEqual(batch.jobs.map(entry=>entry.job.sourceJobId).sort(),['keep-1','keep-2'])
})

test('Task 4 merges duplicate logical vacancies across official sources and preserves provenance',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-last-completed-day.js must exist')
  const now=new Date('2026-09-05T10:00:00.000Z')
  const sourceRunners={
    linkedin:async()=>({jobs:[item({source:'linkedin',id:'li-1',publishedAt:'2026-09-04T09:00:00.000Z',fullJd:'short'})]}),
    jobindex:async()=>({jobs:[item({source:'jobindex',id:'ji-9',publishedAt:'2026-09-04T11:00:00.000Z',fullJd:'a much richer complete job description'})]}),
  }
  const supabase=fakeSupabase({profileRow:profileRow(),settingsRow:settingsRow(['linkedin','jobindex'])})
  const batch=await mod.runNightFlightLastCompletedDayDiscovery({supabase,userId:'user-1',now,sourceRunners})

  assert.equal(batch.jobs.length,1)
  assert.equal(batch.jobs[0].job.fullJd,'a much richer complete job description')
  assert.deepEqual(batch.jobs[0].nightFlightSources,['linkedin','jobindex'])
})

test('Task 4 freezes the discovery batch snapshot and rejects unusable server state',async()=>{
  const mod=await loadModule()
  assert.ok(mod,'night-flight-last-completed-day.js must exist')
  const sourceRunners={linkedin:async()=>({jobs:[]})}
  const now=new Date('2026-09-05T10:00:00.000Z')
  const batch=await mod.runNightFlightLastCompletedDayDiscovery({
    supabase:fakeSupabase({profileRow:profileRow(),settingsRow:settingsRow(['linkedin'])}),
    userId:'user-1',now,sourceRunners,
  })

  assert.equal(Object.isFrozen(batch),true)
  assert.equal(Object.isFrozen(batch.jobs),true)
  assert.equal(Object.isFrozen(batch.sourcesSnapshot),true)
  assert.equal(Object.isFrozen(batch.areasSnapshot),true)

  await assert.rejects(
    ()=>mod.runNightFlightLastCompletedDayDiscovery({supabase:fakeSupabase({profileRow:null,settingsRow:settingsRow(['linkedin'])}),userId:'user-1',now,sourceRunners}),
    /Night Flight profile is not available/i
  )
  await assert.rejects(
    ()=>mod.runNightFlightLastCompletedDayDiscovery({supabase:fakeSupabase({profileRow:profileRow(),settingsRow:settingsRow([])}),userId:'user-1',now,sourceRunners}),
    /Select at least one source/i
  )
})
