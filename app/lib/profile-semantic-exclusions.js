const EXCLUSION_OPERATORS=new Set(['exclude','exclude_if_required','avoid'])
const ELIGIBLE_CATEGORIES=new Set(['domain','role'])

function semanticIntent(rule={}){
  if(rule?.evaluation!=='deterministic') return null
  if(!EXCLUSION_OPERATORS.has(String(rule?.operator??''))) return null
  if(!ELIGIBLE_CATEGORIES.has(String(rule?.category??''))) return null

  const value=String(rule?.value??'').toLowerCase().trim()
  if(!value) return null

  if(/\b(erp|enterprise resource planning|sap(?:\s+s\/4hana|\s+s4hana)?)(?:\s+specialist)?\s+roles?\b/.test(value)||/\bsap\s+specialist\s+roles?\b/.test(value)){
    return 'ERP_SPECIALIST'
  }

  if(/\br\s*&\s*d\s+roles?\b/.test(value)||/\bresearch\s+(?:and|&)\s+development\s+roles?\b/.test(value)){
    return 'R_AND_D'
  }

  return null
}

export function semanticProfileExclusion(job={},rules=[],domainClassification={}){
  const evidence=new Set(Array.isArray(domainClassification?.evidence)?domainClassification.evidence:[])
  for(const rule of Array.isArray(rules)?rules:[]){
    const intent=semanticIntent(rule)
    if(intent==='ERP_SPECIALIST'&&evidence.has('erp')){
      return `Search Profile exclusion: ${rule.originalText||rule.value}`
    }
    if(intent==='R_AND_D'&&evidence.has('r&d')){
      return `Search Profile exclusion: ${rule.originalText||rule.value}`
    }
  }
  return null
}
