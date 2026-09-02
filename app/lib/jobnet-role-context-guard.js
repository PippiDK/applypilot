const ACADEMIC_TITLE=/\b(phd|postdoc|post-doc|professor|professorship|associate professor|assistant professor|tenure track|research fellow|forsker|lektor)\b/i
const CONSTRUCTION_TITLE=/\b(byggeri|byggerier|byggeleder|byggeledere|byggeprojekt|kloakmester|fundering|vejgenopret|anlæg|ejendomme|construction|civil engineering)\b/i
const ADMIN_TITLE=/\b(sagsbehandler|facility management|administration|hr|courier|supporter)\b/i
const HANDS_ON_TITLE=/\b(specialist|developer|engineer|engineering|architect|administrator|supporter)\b/i
const NON_TECH_TITLE=/\b(palliativ|palliative|miljøstyrelsen|anskaffelser|procurement|indkøb|innovation)\b/i

const ROLE_ANCHOR=/\b(project manager|senior project manager|technical project manager|software project manager|projektleder|projektledelse|project lead|delivery manager|delivery lead|program manager|programme manager|program director|programme director|implementation manager|integration manager|transformation manager|execution lead|software execution lead|it[- ]?projekter?|it project|it projects|stå i spidsen)\b/i
const EXPLICIT_TECH_TITLE=/\b(it|software|digital|technology|teknologi|system|platform|integration|technical|teknisk|infrastructure|infrastruktur|data|cloud|cyber|fintech|banking|telecom|satellite)\b/i
const TECH_SIGNALS=[
  /\bsoftware\b/i,/\bit systems?\b/i,/\bit-systemer?\b/i,/\bdigital(?:e)? (?:solution|solutions|løsning|løsninger|platform|platforme|system|systemer)\b/i,
  /\bplatform(?:s|e)?\b/i,/\bapplications?\b/i,/\bapplikation(?:er)?\b/i,/\bintegration(?:s|er)?\b/i,
  /\brelease(?:s)?\b/i,/\bgo[- ]live\b/i,/\buat\b/i,/\bdevops\b/i,/\bcloud\b/i,/\bapi(?:s)?\b/i,
  /\bmigration\b/i,/\btechnical team\b/i,/\bteknisk(?:e)? team\b/i,/\bdevelopment team\b/i,/\budviklingsteam\b/i,
  /\bsaas\b/i,/\bfintech\b/i,/\bcore banking\b/i,/\bdata platform\b/i,/\binfrastructure\b/i,/\binfrastruktur\b/i
]

function text(value){return String(value??'').replace(/[–—_\/&-]+/g,' ').replace(/\s+/g,' ').trim()}
function signalCount(value){return TECH_SIGNALS.reduce((count,pattern)=>count+(pattern.test(value)?1:0),0)}

export function jobnetRoleContextGuard(job={}){
  const title=text(job?.title)
  const jd=text(job?.fullJd||job?.description)
  const combined=`${title} ${jd.slice(0,8000)}`

  if(ACADEMIC_TITLE.test(title)) return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: academic/research role, not IT project or delivery management'}
  if(CONSTRUCTION_TITLE.test(title)&&!EXPLICIT_TECH_TITLE.test(title)) return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: construction/civil project context, not IT/software/digital delivery'}
  if(ADMIN_TITLE.test(title)&&!ROLE_ANCHOR.test(title)) return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: administrative/support role without project or delivery leadership in the title'}
  if(HANDS_ON_TITLE.test(title)&&!ROLE_ANCHOR.test(title)) return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: hands-on specialist role without project or delivery leadership in the title'}
  if(!ROLE_ANCHOR.test(title)) return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:'Jobnet guard: title does not confirm a project/delivery/implementation leadership role'}

  // Explicit IT/software/digital role titles are already strong evidence.
  if(EXPLICIT_TECH_TITLE.test(title)) return {pass:true,stage:'JOBNET_ROLE_CONTEXT_PASS',reason:'Jobnet role context confirmed by title'}

  // Generic Project/Programme titles need multiple concrete delivery signals in the JD.
  const signals=signalCount(combined)
  if(signals<2){
    const domainHint=NON_TECH_TITLE.test(title)?' Non-IT domain is explicit in the title.':''
    return {pass:false,stage:'JOBNET_ROLE_CONTEXT_REJECT',reason:`Jobnet guard: generic project/delivery title lacks sufficient IT/software delivery evidence in the JD (signals: ${signals}).${domainHint}`}
  }

  return {pass:true,stage:'JOBNET_ROLE_CONTEXT_PASS',reason:`Jobnet role context confirmed by ${signals} IT/software delivery signals`}
}
