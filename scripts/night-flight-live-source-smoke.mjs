// Opt-in real network smoke: deliberately not part of npm test.
import {lastCompletedCopenhagenDate} from '../app/lib/night-flight-last-completed-day.js'
import {nightFlightIncrementalDiscoverPage} from '../app/lib/night-flight-source-search.js'
const targetDate=lastCompletedCopenhagenDate(new Date())
const direction={tier:'primary',role:'Senior IT Project Manager',query:'Senior IT Project Manager'}
const results=[]
for(const source of ['linkedin','jobindex','jobnet']){
 try{
  const result=await nightFlightIncrementalDiscoverPage({
   source,direction,targetDate,page:0,now:new Date()
  })
  if(!Array.isArray(result.candidates)||typeof result.hasMore!=='boolean')
   throw new Error('Invalid source page contract')
  results.push({source,ok:true,candidates:result.candidates.length,rawCount:result.rawCount})
 }catch(error){
  results.push({source,ok:false,error:String(error?.message||error).slice(0,180)})
 }
}
console.log(JSON.stringify({targetDate,results}))
if(results.some(row=>!row.ok)) process.exitCode=1
