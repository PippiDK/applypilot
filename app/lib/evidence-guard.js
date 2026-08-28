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
    const normalizedExcerpt=normalizeEvidenceText(excerpt)
    if(!normalizedExcerpt||!normalizedCv.includes(normalizedExcerpt)) throw new Error(`CV evidence ${id} was not found in the selected CV.`)
    if(sectionId==='cv_other') continue
    const sectionText=sections.get(sectionId)
    if(!sectionText) throw new Error(`CV evidence ${id} references an unknown CV section.`)
    if(!normalizeEvidenceText(sectionText).includes(normalizedExcerpt)) throw new Error(`CV evidence ${id} was not found in its claimed CV section.`)
  }
  return true
}
