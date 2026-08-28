const INSTRUCTION_LIKE=/\b(ignore|disregard|forget)\b.{0,50}\b(previous|prior|above|system|developer|instructions?|rules?)\b|\b(system|developer)\s+(message|prompt)\b|\bdo\s+not\s+follow\b.{0,40}\binstructions?\b|\bclaim\b.{0,30}\bexpertise\b/i

const text=value=>String(value??'').trim()

export function normalizeEvidenceText(value=''){
  return String(value??'')
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g,'')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase()
}

function normalizeCvGroundingText(value=''){
  return normalizeEvidenceText(value)
    .replace(/[\uFFFE\uFFFF]/g,'')
    .replace(/(?<=\p{L}{4})-(?=\p{L}{4})/gu,'')
}

function cvGroundingIncludes(source='',excerpt=''){
  const normalizedSource=normalizeEvidenceText(source)
  const normalizedExcerpt=normalizeEvidenceText(excerpt)
  if(!normalizedExcerpt) return false
  if(normalizedSource.includes(normalizedExcerpt)) return true
  const artifactSource=normalizeCvGroundingText(source)
  const artifactExcerpt=normalizeCvGroundingText(excerpt)
  return Boolean(artifactExcerpt)&&artifactSource.includes(artifactExcerpt)
}

export function verifyJdGrounding(jobDescription='',priorities=[]){
  const normalizedJd=normalizeEvidenceText(jobDescription)
  if(!normalizedJd) throw new Error('Insufficient job description for safe tailoring.')
  for(const priority of priorities||[]){
    for(const rawExcerpt of priority?.jdEvidence||[]){
      const excerpt=String(rawExcerpt??'').trim()
      if(INSTRUCTION_LIKE.test(excerpt)) throw new Error(`Unsafe prompt-like JD evidence in ${priority?.id||'priority'}.`)
      const normalizedExcerpt=normalizeEvidenceText(excerpt)
      if(!normalizedExcerpt||!normalizedJd.includes(normalizedExcerpt)) throw new Error(`JD evidence for ${priority?.id||'priority'} was not found in the job description.`)
    }
  }
  return true
}

export function verifySelectedCvBinding({tokenPayload,sourceCv,jobHash}={}){
  const tokenCvId=text(tokenPayload?.cvId)
  const tokenVersion=text(tokenPayload?.sourceVersion)
  const tokenJobHash=text(tokenPayload?.jobHash)
  const sourceCvId=text(sourceCv?.cvId)
  const sourceVersion=text(sourceCv?.sourceVersion)
  const currentJobHash=text(jobHash)
  if(!tokenCvId||!tokenVersion||!tokenJobHash) throw new Error('Selected CV binding is unavailable in the tailoring token.')
  if(!sourceCvId||sourceCvId!==tokenCvId) throw new Error('Selected CV binding does not match the CV ID in the analysed stage.')
  if(!sourceVersion||sourceVersion!==tokenVersion) throw new Error('Selected CV source version does not match the analysed stage.')
  if(!currentJobHash||currentJobHash!==tokenJobHash) throw new Error('Selected CV binding does not match the analysed vacancy.')
  return true
}

export function verifyCvEvidenceGrounding(sourceCvText='',structure={},matches=[]){
  const normalizedCv=normalizeEvidenceText(sourceCvText)
  if(!normalizedCv) throw new Error('Selected CV evidence source is unavailable.')

  const sections=new Map()
  if(structure?.professionalSummary?.eligible&&text(structure.professionalSummary.text)){
    sections.set('professional_summary',structure.professionalSummary.text)
  }
  for(const role of Array.isArray(structure?.employmentSections)?structure.employmentSections:[]){
    if(text(role?.id)&&text(role?.sectionText)) sections.set(text(role.id),role.sectionText)
  }

  for(const match of matches||[]){
    const id=text(match?.id)||'evidence'
    const sectionId=text(match?.sectionId)
    const excerpt=text(match?.excerpt)
    if(!sectionId||!excerpt) throw new Error(`CV evidence ${id} is incomplete.`)
    if(!cvGroundingIncludes(sourceCvText,excerpt)) throw new Error(`CV evidence ${id} was not found in the selected CV.`)
    if(sectionId==='cv_other') continue
    const sectionText=sections.get(sectionId)
    if(!sectionText) throw new Error(`CV evidence ${id} references an unknown CV section.`)
    if(!cvGroundingIncludes(sectionText,excerpt)) throw new Error(`CV evidence ${id} was not found in its claimed CV section.`)
  }
  return true
}

function numericTokens(value=''){
  return (String(value??'').match(/\d+(?:[.,]\d+)?(?:%|\+)?/g)||[]).map(token=>token.replace(',','.'))
}

function truthIssue(code,claim){
  return {code,claim:text(claim)||'Unverified claim.'}
}

function expectedRoleScope(blockId,structure={}){
  if(blockId==='latest_role_overview') return text(structure?.latestRole?.id)
  if(blockId==='previous_role_overview') return text(structure?.previousRole?.id)
  return ''
}

export function deterministicTruthCheck({block,evidence,structure,baseline}={}){
  const blockId=text(block?.blockId)
  const originalText=text(block?.originalText)
  const tailoredText=text(block?.tailoredText)
  if(!blockId) return {blockId:'',verdict:'FAIL',issues:[truthIssue('UNSUPPORTED','Truth Guard received a block without an ID.')],safeText:originalText||null}
  if(block?.status!=='generated'||!tailoredText) return {blockId,verdict:'PASS',issues:[],safeText:originalText||null}

  const matches=Array.isArray(evidence?.matches)?evidence.matches:[]
  const byId=new Map(matches.map(item=>[text(item?.id),item]).filter(([id])=>id))
  const baselineCv=text(baseline?.cvText)
  const baselineCvId=text(baseline?.cvId)
  const baselineVersion=text(baseline?.sourceVersion)
  const requiredScope=expectedRoleScope(blockId,structure)
  const issues=[]
  const referenced=[]

  for(const claim of Array.isArray(block?.claims)?block.claims:[]){
    const ids=Array.isArray(claim?.evidenceIds)?claim.evidenceIds.map(text).filter(Boolean):[]
    if(!ids.length){
      issues.push(truthIssue('UNKNOWN_EVIDENCE',claim?.text))
      continue
    }
    const cited=[]
    for(const id of ids){
      const match=byId.get(id)
      if(!match){
        issues.push(truthIssue('UNKNOWN_EVIDENCE',claim?.text))
        continue
      }
      if((text(match?.cvId)&&text(match.cvId)!==baselineCvId)||(text(match?.sourceVersion)&&text(match.sourceVersion)!==baselineVersion)){
        issues.push(truthIssue('UNKNOWN_EVIDENCE',claim?.text))
        continue
      }
      const excerpt=text(match?.excerpt)
      if(!baselineCv||!excerpt||!cvGroundingIncludes(baselineCv,excerpt)){
        issues.push(truthIssue('UNKNOWN_EVIDENCE',claim?.text))
        continue
      }
      try{ verifyCvEvidenceGrounding(baselineCv,structure,[match]) }
      catch{
        issues.push(truthIssue('UNKNOWN_EVIDENCE',claim?.text))
        continue
      }
      if(requiredScope&&text(match?.sectionId)!==requiredScope){
        issues.push(truthIssue('WRONG_ROLE_SCOPE',claim?.text))
        continue
      }
      cited.push(match)
      referenced.push(match)
    }
    const available=new Set(numericTokens(cited.map(item=>item.excerpt).join(' ')))
    for(const token of numericTokens(claim?.text)) if(!available.has(token)) issues.push(truthIssue('METRIC_MISMATCH',claim?.text))
  }

  const availableAll=new Set(numericTokens(referenced.map(item=>item.excerpt).join(' ')))
  for(const token of numericTokens(tailoredText)) if(!availableAll.has(token)) issues.push(truthIssue('METRIC_MISMATCH',tailoredText))

  const unique=[]
  const seen=new Set()
  for(const item of issues){
    const key=`${item.code}|${item.claim}`
    if(seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }
  return {blockId,verdict:unique.length?'FAIL':'PASS',issues:unique,safeText:unique.length?(originalText||null):tailoredText}
}
