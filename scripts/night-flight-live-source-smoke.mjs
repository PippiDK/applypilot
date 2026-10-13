// Opt-in real network smoke: deliberately not part of npm test.
import {lastCompletedCopenhagenDate} from '../app/lib/night-flight-last-completed-day.js'
import {nightFlightIncrementalDiscoverPage,nightFlightIncrementalResolveDetail} from '../app/lib/night-flight-source-search.js'
const targetDate=lastCompletedCopenhagenDate(new Date())
const direction={tier:'primary',role:'Senior IT Project Manager',query:'Senior IT Project Manager'}
const results=[]
for(const source of ['linkedin','jobindex','jobnet']){
 let candidateInfo=null
 try{
  const result=await nightFlightIncrementalDiscoverPage({
   source,direction,targetDate,page:0,now:new Date()
  })
  if(!Array.isArray(result.candidates)||typeof result.hasMore!=='boolean')
   throw new Error('Invalid source page contract')
  let detail='NO_TARGET_CANDIDATE'
  if(result.candidates.length){
   candidateInfo={jobAdId:result.candidates[0].jobAdId||null,isExternal:result.candidates[0].record?.isExternal??null}
   try{
    const outcome=await nightFlightIncrementalResolveDetail({
     source,candidate:result.candidates[0],targetDate,exclusionRules:[],now:new Date()
    })
    detail=outcome?.job?'VERIFIED_AND_MATCHED':'VERIFIED_OR_FILTERED'
   }catch(error){
    // An external Jobnet card may not expose its full JD through Jobnet's
    // internal detail endpoint. Record it as unverified; never fabricate JD.
    if(source==='jobnet'&&candidateInfo?.isExternal===true&&
       /Jobnet HTTP 404/.test(String(error?.message||error))){
      detail='UNVERIFIED_EXTERNAL_404'
    }else throw error
   }
  }
  results.push({source,ok:true,candidates:result.candidates.length,rawCount:result.rawCount,detail,candidateInfo})
 }catch(error){
  results.push({source,ok:false,error:String(error?.message||error).slice(0,180),candidateInfo})
 }
}
console.log(JSON.stringify({targetDate,results}))
if(results.some(row=>!row.ok)) process.exitCode=1
