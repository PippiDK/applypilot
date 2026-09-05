const NIGHT_FLIGHT_SYNC_WARNING_ID='night-flight-sync-warning'
const NIGHT_FLIGHT_SYNC_WARNING_TEXT='Night Flight profile sync failed. Your latest profile is saved locally but is not available for overnight processing.'

function removeNightFlightSyncWarning(){
  if(typeof document==='undefined') return
  document.getElementById(NIGHT_FLIGHT_SYNC_WARNING_ID)?.remove()
}

function surfaceNightFlightSyncWarning(){
  if(typeof document==='undefined') return
  let warning=document.getElementById(NIGHT_FLIGHT_SYNC_WARNING_ID)
  if(!warning){
    warning=document.createElement('div')
    warning.id=NIGHT_FLIGHT_SYNC_WARNING_ID
    warning.setAttribute('role','alert')
    warning.style.position='fixed'
    warning.style.top='16px'
    warning.style.right='16px'
    warning.style.zIndex='9999'
    warning.style.maxWidth='420px'
    warning.style.padding='12px 14px'
    warning.style.border='1px solid currentColor'
    warning.style.borderRadius='8px'
    warning.style.background='Canvas'
    warning.style.color='CanvasText'
    warning.style.boxShadow='0 8px 24px rgba(0,0,0,.18)'
    warning.style.fontSize='14px'
    warning.style.lineHeight='1.4'
    document.body.appendChild(warning)
  }
  warning.textContent=NIGHT_FLIGHT_SYNC_WARNING_TEXT
}

export async function syncNightFlightProfile({searchProfile,cv}={}){
  try{
    const response=await fetch('/api/night-flight/profile-sync',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({searchProfile:searchProfile||{},cv:cv||null}),
    })
    const data=await response.json().catch(()=>({}))
    if(!response.ok) throw new Error(data.error||'Night Flight profile sync failed.')
    removeNightFlightSyncWarning()
    return {ok:true,...data}
  }catch(error){
    const errorMessage=error?.message||'Night Flight profile sync failed.'
    console.error('[Night Flight] profile sync failed',errorMessage)
    surfaceNightFlightSyncWarning()
    throw new Error(errorMessage)
  }
}
