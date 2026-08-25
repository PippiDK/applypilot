const WINDOWS=[1,3,7,14]

export function discoveryWindowsFor(freshnessDays=7){
  const requested=Math.max(1,Number(freshnessDays)||7)
  return WINDOWS.filter(days=>days<=requested)
}

export function buildDiscoveryPlan(queries=[],freshnessDays=7){
  return discoveryWindowsFor(freshnessDays).flatMap(days=>
    queries.map(query=>({query,days,seconds:days*86400}))
  )
}
