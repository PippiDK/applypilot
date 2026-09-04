export async function syncNightFlightProfile({searchProfile,cv}={}){
  try{
    const response=await fetch('/api/night-flight/profile-sync',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({searchProfile:searchProfile||{},cv:cv||null}),
    })
    const data=await response.json().catch(()=>({}))
    if(!response.ok) return {ok:false,error:data.error||'Night Flight profile sync failed.'}
    return {ok:true,...data}
  }catch(error){
    return {ok:false,error:error?.message||'Night Flight profile sync failed.'}
  }
}
