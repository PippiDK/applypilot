const INSTRUCTION_LIKE=/\b(ignore|disregard|forget)\b.{0,50}\b(previous|prior|above|system|developer|instructions?|rules?)\b|\b(system|developer)\s+(message|prompt)\b|\bdo\s+not\s+follow\b.{0,40}\binstructions?\b|\bclaim\b.{0,30}\bexpertise\b/i

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
