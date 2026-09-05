import {runNightFlightUser} from './night-flight-runner.js'

export const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'

const copenhagenHourFormatter=new Intl.DateTimeFormat('en-GB',{
  timeZone:COPENHAGEN_TIME_ZONE,
  hour:'2-digit',
  hourCycle:'h23',
})

export function isCopenhagenNightFlightHour(now=new Date()){
  const date=now instanceof Date?now:new Date(now)
  if(Number.isNaN(date.getTime())) throw new Error('Valid scheduler time is required')
  return copenhagenHourFormatter.format(date)==='02'
}

export async function listEnabledNightFlightUsers({supabase}={}){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
  const {data,error}=await supabase
    .from('night_flight_settings')
    .select('user_id')
    .eq('enabled',true)

  if(error) throw new Error(`Night Flight enabled-user query failed: ${error.message||'unknown Supabase error'}`)
  return Array.isArray(data)?data:[]
}

export async function runNightFlightScheduler({
  supabase,
  now=new Date(),
  runUser=runNightFlightUser,
}={}){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
  if(typeof runUser!=='function') throw new Error('Night Flight user runner is required')

  if(!isCopenhagenNightFlightHour(now)){
    return {status:'SKIPPED_TIME',usersEligible:0,usersSucceeded:0,usersFailed:0}
  }

  const users=await listEnabledNightFlightUsers({supabase})
  let usersSucceeded=0
  let usersFailed=0

  for(const row of users){
    const userId=String(row?.user_id||'').trim()
    if(!userId){
      usersFailed+=1
      continue
    }
    try{
      await runUser({supabase,userId,now})
      usersSucceeded+=1
    }catch{
      usersFailed+=1
      console.error('Night Flight user run failed')
    }
  }

  return {
    status:'DISPATCHED',
    usersEligible:users.length,
    usersSucceeded,
    usersFailed,
  }
}
