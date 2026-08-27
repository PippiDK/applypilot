const clean=value=>String(value??'')
  .toLowerCase()
  .replace(/[–—_/&]+/g,' ')
  .replace(/[^a-z0-9æøå+.# -]/g,' ')
  .replace(/\s+/g,' ')
  .trim()

const MANAGEMENT_FAMILIES=new Set(['delivery-management','implementation-transformation'])

function normalizeRole(value=''){
  return clean(value).replace(/-/g,' ')
    .replace(/\bprogramme\b/g,'program')
    .replace(/\bprojektledere?\b/g,'project manager')
    .replace(/\bprojektledelse\b/g,'project management')
    .replace(/\bprogramledere?\b/g,'program manager')
    .replace(/\bprogramledelse\b/g,'program management')
    .replace(/\bprojekter\b/g,'projects')
    .replace(/\bprojekt\b/g,'project')
    .replace(/\barkitekt\b/g,'architect')
    .replace(/\bforretningsanalytiker\b/g,'business analyst')
    .replace(/\btestleder\b/g,'test manager')
}

function match(title,pattern,label){
  return pattern.test(title)?[label]:null
}

export function classifyProfileRoleFamily(job={}){
  const title=normalizeRole(job?.title)

  let evidence=match(title,/\b(head of|director|vice president|vp|chief)\b/,'executive title')
  if(evidence) return {family:'executive',evidence}

  evidence=match(title,/\b(product owner|product manager|product lead|product director)\b/,'product role')
  if(evidence) return {family:'product',evidence}

  evidence=match(title,/\b(enterprise architect|solution architect|systems? architect|it architect|technical architect|domain architect|architect)\b/,'architecture role')
  if(evidence) return {family:'architecture',evidence}

  evidence=match(title,/\b(business analyst|systems? analyst|data analyst|it analyst|analyst|analysechef)\b/,'analysis role')
  if(evidence) return {family:'analysis',evidence}

  evidence=match(title,/\b(test manager|test lead|qa manager|qa lead|quality assurance|software tester|testing manager)\b/,'quality/test role')
  if(evidence) return {family:'quality-test',evidence}

  evidence=match(title,/\b(software engineering manager|engineering manager|software engineer|software developer|developer|programmer|tech lead|development lead)\b/,'software builder role')
  if(evidence) return {family:'software-builder',evidence}

  evidence=match(title,/\b(implementation manager|implementation lead|transformation manager|transformation lead|change manager|change and project manager|project manager.*transformation|transformation project manager)\b/,'implementation/transformation role')
  if(evidence) return {family:'implementation-transformation',evidence}

  evidence=match(title,/\b(project manager|project management|program manager|program management|delivery manager|delivery lead|delivery management|project lead|program lead|pmo)\b/,'delivery-management role')
  if(evidence) return {family:'delivery-management',evidence}

  evidence=match(title,/\bdrive\b.*\bprojects?\b/,'explicitly drives projects')
  if(evidence) return {family:'delivery-management',evidence}

  evidence=match(title,/\b(specialist|consultant|advisor|adviser|konsulent|rådgiver|custodian|kustode)\b/,'specialist role')
  if(evidence) return {family:'specialist',evidence}

  return {family:'other',evidence:[]}
}

export function profileRoleFamiliesCompatible(jobFamily='',directionFamily=''){
  if(!jobFamily||!directionFamily||jobFamily==='other'||directionFamily==='other') return false
  if(jobFamily===directionFamily) return true
  return MANAGEMENT_FAMILIES.has(jobFamily)&&MANAGEMENT_FAMILIES.has(directionFamily)
}
