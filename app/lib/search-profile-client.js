const text=value=>String(value??'').trim()

export async function requestSearchProfileRoles({cvText,fetchImpl=fetch}={}){
  const res=await fetchImpl('/api/search-profile',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cvText:text(cvText)})
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data?.error||'Search Profile generation failed. Please try again.')
  return data.roles
}

export async function requestSearchProfileExclusions({exclusionsText,fetchImpl=fetch}={}){
  const res=await fetchImpl('/api/search-profile',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({mode:'exclusions',exclusionsText:text(exclusionsText)})
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data?.error||'Search Profile exclusions processing failed. Please try again.')
  return data.exclusions
}
