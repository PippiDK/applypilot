import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceNightFlightIncrementalDiscovery} from './night-flight-incremental-pipeline.js'

test('Orchestration resumes durable claimed units across invocations, then freezes once',async()=>{
 const units=[
  {id:'unit-a',discovery_run_id:'discovery-a',phase:'DISCOVERY',source:'linkedin'},
  {id:'unit-b',discovery_run_id:'discovery-a',phase:'DISCOVERY',source:'jobnet'},
 ]
 const events=[]
 let frozen=false
 const db={
  from(table){
   if(table!=='night_flight_discovery_runs') throw Error('unexpected table '+table)
   return {select(){return this},eq(){return this},order(){return this},limit(){return this},
    then(resolve){return Promise.resolve({data:frozen?[]:[{id:'discovery-a'}],error:null}).then(resolve)},
    async single(){return {data:{id:'discovery-a',state:'DISCOVERING',initialized:true,
     target_date:'2026-10-12',areas:[]},error:null}}}
  },
  async rpc(name,args){
   if(name==='claim_night_flight_discovery_unit'){
     const item=units.find(u=>u.phase!=='DONE'&&!u.claimed)
     if(item){item.claimed=true;events.push('claim:'+item.id)}
     return {data:item?[{...item}]:[],error:null}
   }
   if(name==='freeze_night_flight_discovery_with_failures'){
    frozen=true;events.push('freeze')
    return {data:'match-run-1',error:null}
   }
   throw Error('unexpected RPC '+name)
  }
 }
 // Scheduler is deliberately outside this test: pass an hour before 02:00
 // so the worker exercises an existing snapshot without attempting to seed.
 const now=new Date('2026-10-13T23:30:00Z') // 01:30 Copenhagen, Oct 14
 const runStep=async({unit})=>{
  unit.claimed=true
  const actual=units.find(u=>u.id===unit.id)
  actual.phase='DONE';events.push('checkpoint:'+unit.id)
  return {unitId:unit.id,phase:'DONE'}
 }
 // Freeze invokes the real merger; fake its completed units and frozen jobs.
 const originalFrom=db.from.bind(db)
 db.from=(table)=>{
  if(table==='night_flight_discovery_units') return {
   select(){return this},eq(){return this},
   then(resolve){
    const data=units.map(u=>({phase:u.phase,source:u.source,
     verified_jobs:[],candidates:[],last_error:null}))
    return Promise.resolve({data,error:null}).then(resolve)
   }
  }
  return originalFrom(table)
 }
 const first=await advanceNightFlightIncrementalDiscovery({supabase:db,now,maxSteps:1,runStep})
 assert.equal(first.steps.length,1)
 assert.equal(first.frozen.length,0)
 const second=await advanceNightFlightIncrementalDiscovery({supabase:db,now,maxSteps:1,runStep})
 assert.equal(second.steps.length,1)
 assert.equal(second.frozen.length,1)
 assert.equal(second.frozen[0].runId,'match-run-1')
 assert.deepEqual(events,['claim:unit-a','checkpoint:unit-a','claim:unit-b','checkpoint:unit-b','freeze'])
});
