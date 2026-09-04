export async function syncNightFlightProfile({searchProfile,cv}={}){
  try{
    const response=await fetch('/api/night-flight/profile-sync',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({searchProfile:searchProfile||{},cv:cv||null}),
    })
    const data=await response.json().catch(()=>({}))
    if(response.ok) return {ok:true,...data}
    const errorMessage=data.error||'Night Flight profile sync failed.'
    console.error('[Night Flight] profile sync failed',errorMessage)
    throw new Error(errorMessage)
  }catch(error){
    const errorMessage=error?.message||'Night Flight profile sync failed.'
    console.error('[Night Flight] profile sync failed',errorMessage)
    throw new Error(errorMessage)
  }
}
