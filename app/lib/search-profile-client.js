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
