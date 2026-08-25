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
