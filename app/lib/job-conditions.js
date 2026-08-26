const text=value=>String(value??'').trim()
const norm=value=>text(value).toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim()
const title=value=>text(value).replace(/(^|[-_\s])([a-z])/g,(_,p,c)=>p+c.toUpperCase())

function areaCondition(job,profile){
  const location=text(job?.location)
  if(!location) return {score:null,value:'N/A'}
  const prefs=text(profile?.preferredLocations).split(/[,;\n]/).map(norm).filter(Boolean)
  if(!prefs.length) return {score:null,value:location}
  const loc=norm(location)
  const matched=prefs.some(pref=>loc.includes(pref)||pref.includes(loc))
  return {score:matched?100:0,value:location}
}

function salaryValue(job){
  const lowRaw=job?.salaryMinDkkMonth, highRaw=job?.salaryMaxDkkMonth
  const low=lowRaw==null?null:(Number.isFinite(Number(lowRaw))?Number(lowRaw):null)
  const high=highRaw==null?null:(Number.isFinite(Number(highRaw))?Number(highRaw):null)
  if(low==null&&high==null) return {low:null,high:null,value:'Not stated'}
  const fmt=value=>Math.round(value).toLocaleString('en-DK')
  if(low!=null&&high!=null) return {low,high,value:`${fmt(low)}–${fmt(high)} DKK/month`}
  const single=low??high
  return {low,high,value:`${fmt(single)} DKK/month`}
}

function salaryCondition(job,profile){
  const salary=salaryValue(job)
  if(salary.low==null&&salary.high==null) return {score:null,value:salary.value}
  const floor=Number(profile?.salary)
  if(!Number.isFinite(floor)||floor<=0) return {score:null,value:salary.value}
  if(salary.low!=null&&salary.low>=floor) return {score:100,value:salary.value}
  if(salary.high!=null&&salary.high>=floor) return {score:50,value:salary.value}
  return {score:0,value:salary.value}
}

function normalizeEmployment(value=''){
  const v=norm(value)
  if(!v||v==='unknown') return 'N/A'
  if(/permanent|full[- ]?time/.test(v)) return 'Permanent'
  if(/fixed[- ]?term|temporary/.test(v)) return /fixed/.test(v)?'Fixed-term':'Temporary'
  if(/contract|consultant|freelance/.test(v)) return /freelance/.test(v)?'Freelance / Consultant':'Contract'
  if(/part[- ]?time/.test(v)) return 'Part-time'
  if(/intern/.test(v)) return 'Internship'
  return title(v)
}

function normalizeWorkModel(value=''){
  const v=norm(value)
  if(!v||v==='unknown') return 'N/A'
  if(/hybrid/.test(v)) return 'Hybrid'
  if(/remote/.test(v)) return 'Remote'
  if(/onsite|on-site|on site/.test(v)) return 'On-site'
  if(/flexible|mixed/.test(v)) return 'Flexible / Mixed'
  return title(v)
}

function binaryPreferenceCondition(value,accepted,normalizeDisplay){
  const display=normalizeDisplay(value)
  if(display==='N/A') return {score:null,value:display}
  if(!Array.isArray(accepted)||!accepted.length) return {score:null,value:display}
  const allowed=accepted.map(norm)
  return {score:allowed.includes(norm(value))||allowed.includes(norm(display))?100:0,value:display}
}

export function evaluateJobConditions(job={},profile={}){
  return {
    area:areaCondition(job,profile),
    salary:salaryCondition(job,profile),
    employmentType:binaryPreferenceCondition(job.employmentType,profile.acceptedEmploymentTypes,normalizeEmployment),
    workModel:binaryPreferenceCondition(job.remoteType,profile.acceptedWorkModels,normalizeWorkModel)
  }
}
