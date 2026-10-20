// Apply Pilot v20 display-only provenance filters.
// Night Flight matching belongs to the independent bridge; this module accepts a predicate.
export function filterByVisibleProvenance(items=[],{showImported=true,showNightPilot=true,isNightFlightJob=()=>false}={}){
  return items.filter(item=>{
    const job=item?.job||{}
    return (showImported||job.importSource!=='linkedin-json')&&
      (showNightPilot||!isNightFlightJob(job))
  })
}
