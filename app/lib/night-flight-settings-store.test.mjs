import test from 'node:test'
import assert from 'node:assert/strict'

async function loadStoreModule(){
  try{return await import('./night-flight-settings-store.js')}catch{return null}
}

function fakeSupabase({row=null,readError=null,writeError=null}={}){
  const calls=[]
  return {
    calls,
    from(table){
      calls.push(['from',table])
      return {
        select(columns){calls.push(['select',columns]);return this},
        eq(column,value){calls.push(['eq',column,value]);return this},
        async maybeSingle(){return {data:row,error:readError}},
        async upsert(payload,options){calls.push(['upsert',payload,options]);return {error:writeError}},
      }
    },
  }
}

test('settings read returns safe defaults when the user has no row yet',async()=>{
  const mod=await loadStoreModule()
  assert.ok(mod,'night-flight-settings-store.js must exist')
  const supabase=fakeSupabase()
  const settings=await mod.loadNightFlightSettings({supabase,userId:'user-1'})
  assert.deepEqual(settings,{enabled:false,sources:['linkedin','jobindex','jobnet'],areas:[]})
  assert.ok(supabase.calls.some(call=>call[0]==='eq'&&call[1]==='user_id'&&call[2]==='user-1'))
})

test('settings save validates and upserts only the authenticated user row',async()=>{
  const mod=await loadStoreModule()
  assert.ok(mod,'night-flight-settings-store.js must exist')
  const supabase=fakeSupabase()
  const saved=await mod.saveNightFlightSettings({
    supabase,
    userId:'user-1',
    settings:{enabled:true,sources:['linkedin','jobnet'],areas:['copenhagen_north']},
    now:'2026-09-05T20:00:00.000Z',
  })
  assert.deepEqual(saved,{enabled:true,sources:['linkedin','jobnet'],areas:['copenhagen_north'],updatedAt:'2026-09-05T20:00:00.000Z'})
  const upsert=supabase.calls.find(call=>call[0]==='upsert')
  assert.equal(upsert[1].user_id,'user-1')
  assert.deepEqual(upsert[1].sources,['linkedin','jobnet'])
  assert.deepEqual(upsert[2],{onConflict:'user_id'})
})

test('settings persistence failures are surfaced rather than silently accepted',async()=>{
  const mod=await loadStoreModule()
  assert.ok(mod,'night-flight-settings-store.js must exist')
  await assert.rejects(
    ()=>mod.loadNightFlightSettings({supabase:fakeSupabase({readError:{message:'read failed'}}),userId:'user-1'}),
    /Night Flight settings read failed: read failed/
  )
  await assert.rejects(
    ()=>mod.saveNightFlightSettings({supabase:fakeSupabase({writeError:{message:'write failed'}}),userId:'user-1',settings:{enabled:false,sources:['linkedin'],areas:[]}}),
    /Night Flight settings save failed: write failed/
  )
})
