const WINDOWS=[1,3,7,14]
const DEEP_PAGE_WINDOWS=new Set([7,14])
const DEEP_PAGE_STARTS=[0,25]

export function discoveryWindowsFor(freshnessDays=7){
  const requested=Math.max(1,Number(freshnessDays)||7)
  return WINDOWS.filter(days=>days<=requested)
}

export function discoveryStartsFor(days){
  return DEEP_PAGE_WINDOWS.has(Number(days))?[...DEEP_PAGE_STARTS]:[0]
}

export function buildDiscoveryPlan(queries=[],freshnessDays=7){
  return discoveryWindowsFor(freshnessDays).flatMap(days=>
    queries.flatMap(query=>
      discoveryStartsFor(days).map(start=>({query,days,seconds:days*86400,start}))
    )
  )
}

function repeatedPasses(group,days,starts,count){
  return Array.from({length:count},(_,index)=>({
    group,
    days,
    starts:[...starts],
    label:`${group}-pass-${index+1}`,
  }))
}

export function buildDiscoveryPasses(freshnessDays=7){
  const requested=[1,3,7,14].includes(Number(freshnessDays))?Number(freshnessDays):7

  if(requested===14){
    return [
      ...repeatedPasses('7d',7,[0,25],2),
      ...repeatedPasses('14d',14,[0,25],1),
    ]
  }

  if(requested===7){
    return [
      ...repeatedPasses('7d',7,[0,25,50],2),
      ...repeatedPasses('7d',7,[0,25],1).map(pass=>({...pass,label:'7d-pass-3'})),
    ]
  }
  if(requested===3) return repeatedPasses('3d',3,[0,25],3)
  return repeatedPasses('1d',1,[0,25],3)
}
