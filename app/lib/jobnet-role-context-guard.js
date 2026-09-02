const ACADEMIC_TITLE=/\b(phd|postdoc|post-doc|professor|professorship|associate professor|assistant professor|tenure track|research fellow|forsker|lektor)\b/i
const CONSTRUCTION_TITLE=/\b(byggeri|byggerier|byggeleder|byggeledere|byggeprojekt|kloakmester|fundering|vejgenopret|anlæg|ejendomme|construction|civil engineering)\b/i
const ADMIN_TITLE=/\b(sagsbehandler|facility management|administration|hr|courier|supporter)\b/i
const HANDS_ON_TITLE=/\b(specialist|developer|engineer|engineering|architect|administrator|supporter)\b/i

const ROLE_ANCHOR=/\b(project manager|senior project manager|technical project manager|software project manager|projektleder|projektledelse|project lead|delivery manager|delivery lead|program manager|programme manager|program director|programme director|implementation manager|integration manager|transformation manager|execution lead|software execution lead|it[- ]?projekter?|it project|it projects|stå i spidsen)\b/i
const TECH_CONTEXT=/\b(it|software|digital|technology|teknologi|system|systemer|platform|platforme|data|integration|integrationer|cloud|cyber|infrastructure|infrastruktur|application|applications|api|devops|network|netværk|saas|fintech|banking|telecom|telecommunications|satellite|erp|crm)\b/i

function text(value){return String(value??'').replace(/[–—_\/&-]+/g,' ').replace(/\s+/g,' ').trim()}

export function jobnetRoleContextGuard(job={}){
  const title=text(job?.title)
  const jd=text(job?.fullJd||job?.description)
  const combined=`${title} ${jd.slice(0,6000)}`

  if(ACADEMIC_TITLE.test(title)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: academic/research role, not IT project or delivery management'}
  }

  if(CONSTRUCTION_TITLE.test(title)&&!TECH_CONTEXT.test(title)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: construction/civil project context, not IT/software/digital delivery'}
  }

  if(ADMIN_TITLE.test(title)&&!ROLE_ANCHOR.test(title)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: administrative/support role without project or delivery leadership in the title'}
  }

  if(HANDS_ON_TITLE.test(title)&&!ROLE_ANCHOR.test(title)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: hands-on specialist role without project or delivery leadership in the title'}
  }

  if(!ROLE_ANCHOR.test(title)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: title does not confirm a project/delivery/implementation leadership role'}
  }

  if(!TECH_CONTEXT.test(combined)){
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: role context is not IT/software/digital delivery'}
  }

  return {pass:true,stage:'JOBNET_ROLE_CONTEXT_PASS',reason:'Jobnet role context confirmed'}
}
