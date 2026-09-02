export async function collectDiscoveryPasses({queries=[],passes=[],fetchPage}={}){
  if(typeof fetchPage!=='function') throw new Error('fetchPage is required')

  const byId=new Map()
  const stableGroups=new Set()
  const groups={}
  const passStats=[]
  const errors=[]
  let searchRequests=0
  let searchFailures=0
  let searchRows=0

  for(const pass of passes){
    const group=String(pass.group||pass.days||'default')
    if(stableGroups.has(group)) continue

    let newJobIds=0
    let passFailures=0
    let passRequests=0
    let passRows=0

    for(const query of queries){
      for(const start of pass.starts||[0]){
        const meta={...pass,query,start,seconds:Number(pass.days)*86400}
        searchRequests++
        passRequests++
        try{
          const rows=await fetchPage(meta)
          const list=Array.isArray(rows)?rows:[]
          searchRows+=list.length
          passRows+=list.length
          for(const row of list){
            const id=String(row?.jobId||'')
            if(!id) continue
            if(!byId.has(id)){
              byId.set(id,{...row,__discoveryQueries:[String(query)]})
              newJobIds++
            }else{
              const existing=byId.get(id)
              const observed=new Set(Array.isArray(existing.__discoveryQueries)?existing.__discoveryQueries:[])
              observed.add(String(query))
              existing.__discoveryQueries=[...observed]
            }
          }
          if(list.length===0) break
        }catch(error){
          searchFailures++
          passFailures++
          errors.push(String(error?.message||error))
        }
      }
    }

    const previous=groups[group]||{stable:false,passesExecuted:0,newJobIds:0}
    const current={
      stable:false,
      passesExecuted:previous.passesExecuted+1,
      newJobIds:previous.newJobIds+newJobIds,
    }
    if(current.passesExecuted>1 && newJobIds===0 && passFailures===0){
      current.stable=true
      stableGroups.add(group)
    }
    groups[group]=current
    passStats.push({
      label:pass.label||`${group}-pass-${current.passesExecuted}`,
      group,
      days:Number(pass.days),
      requests:passRequests,
      rows:passRows,
      failures:passFailures,
      newJobIds,
      totalUnique:byId.size,
    })
  }

  return {
    rows:[...byId.values()],
    groups,
    passStats,
    searchRequests,
    searchFailures,
    searchRows,
    errors,
  }
}
