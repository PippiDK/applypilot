const clean=value=>String(value??'')
  .toLowerCase()
  .replace(/[–—_/&]+/g,' ')
  .replace(/[^a-z0-9æøå+.# -]/g,' ')
  .replace(/\s+/g,' ')
  .trim()

function evidenceFor(text,groups){
  const evidence=[]
  for(const [label,pattern] of groups){
    if(pattern.test(text)) evidence.push(label)
  }
  return evidence
}

const TARGET_GROUPS=[
  ['tech:systems',/\b(information technology|enterprise it|corporate it|group it|it systems?|it platform|technology delivery|technology projects?|software|applications?|enterprise applications?|saas|digitale løsninger|it systemer|it platforme)\b/],
  ['tech:integration',/\b(api|apis|middleware|integration|integrations|interfaces?|integrationer)\b/],
  ['tech:cloud-data',/\b(cloud|azure|aws|gcp|data platform|data foundation|data warehouse|analytics platform|business intelligence|databricks|snowflake)\b/],
  ['tech:cyber-ot',/\b(cyber|cybersecurity|scada|ot security|operational technology)\b/],
  ['tech:digital',/\b(digital delivery|digital transformation|digital projects?|digitalisation|digitalization|digitalisering|digitaliseringsprojekter|teknologiprojekter|tekniske leverancer)\b/],
]

const PHYSICAL_GROUPS=[
  ['physical:construction',/\b(construction|civil engineering|site works?|building works?|contractors?|byggeri|byggeprojekter|byggeplads|entreprenører?|entreprise|entreprisestyring)\b/],
  ['physical:roads',/\b(roads?|highways?|road design|traffic infrastructure|vejprojekter|veje|trafik|anlægsprojekter|anlæg)\b/],
  ['physical:mechanical',/\b(mechanical|hvac|piping|plant equipment|physical installation|installation works?|mekanisk|installation)\b/],
  ['physical:utilities',/\b(power grid|electric grid|utility infrastructure|water infrastructure|wastewater|10\/0[,.]4 kv|el anlæg|forsyning|spildevand|drikkevand)\b/],
]

const FUNCTIONAL_GROUPS=[
  ['functional:finance',/\b(finance|financial accounting|accounting|controlling|month end|finance process|finance workstream|økonomi|regnskab)\b/],
  ['functional:hr-payroll',/\b(payroll|human resources|hr process|employee lifecycle|people operations|løn|personale)\b/],
  ['functional:marketing-content',/\b(marketing|campaigns?|brand|content strategy|web content|media planning)\b/],
  ['functional:procurement',/\b(procurement|purchasing|sourcing|indkøb)\b/],
  ['functional:property',/\b(property|real estate|facilities|facility management|leases?|ejendom)\b/],
  ['functional:regulatory-affairs',/\b(regulatory affairs|regulatory submissions?|product registrations?|authority correspondence)\b/],
]

const STRONG_PHYSICAL_TITLE=/\b(roads?|highways?|construction|civil|mechanical construction|geotechnical|geoteknisk|byggeri|anlægsprojekter|anlæg|vejprojekter|trafik|entreprisestyring)\b/
const EXPLICIT_TECH_TITLE=/\b(it project|it program|it programme|information technology|software|data platform|cloud|integration|digital project|digital transformation|cyber|scada|ot security|teknisk it|it projekt|digitalisering)\b/
const STRONG_FUNCTIONAL_TITLE=/\b(finance project|financial project|payroll|marketing project|content project|procurement|purchasing project|property|real estate|facilities|regulatory affairs)\b/
const ERP_TITLE=/\b(sap|s\/4hana|s4hana|erp|enterprise resource planning|dynamics 365|d365|oracle erp)\b/
const ERP_DETAIL=/\b(configuration|modules?|customi[sz]ation|fit to standard|erp implementation|s\/4hana implementation|s4hana implementation)\b/
const RND_TITLE=/\b(r\s*&?\s*d|research and development|research & development)\b/
const RND_DETAIL=/\b(product development|design controls?|laboratory|clinical development|research program|research programme|r&d engineering)\b/

export function classifyDeliveryDomain(job={}){
  const title=clean(job?.title)
  const description=clean(job?.description)
  const text=`${title} ${description}`.trim()

  const erpInTitle=ERP_TITLE.test(title)
  const erpDetailed=ERP_TITLE.test(text)&&ERP_DETAIL.test(description)
  if(erpInTitle||erpDetailed){
    return {domain:'EXCLUDED_SPECIALISM',evidence:['erp']}
  }

  const rndInTitle=RND_TITLE.test(title)
  const rndDetailed=RND_TITLE.test(text)&&RND_DETAIL.test(description)
  if(rndInTitle||rndDetailed){
    return {domain:'EXCLUDED_SPECIALISM',evidence:['r&d']}
  }

  const targetEvidence=evidenceFor(text,TARGET_GROUPS)
  const physicalEvidence=evidenceFor(text,PHYSICAL_GROUPS)
  const functionalEvidence=evidenceFor(text,FUNCTIONAL_GROUPS)
  const explicitTechTitle=EXPLICIT_TECH_TITLE.test(title)
  const strongPhysicalTitle=STRONG_PHYSICAL_TITLE.test(title)
  const strongFunctionalTitle=STRONG_FUNCTIONAL_TITLE.test(title)

  if(strongPhysicalTitle){
    return {domain:'NON_TARGET_PHYSICAL',evidence:physicalEvidence.length?physicalEvidence:['physical:title']}
  }

  if(strongFunctionalTitle&&!explicitTechTitle){
    return {domain:'NON_TARGET_FUNCTIONAL',evidence:functionalEvidence.length?functionalEvidence:['functional:title']}
  }

  if(explicitTechTitle&&targetEvidence.length>=1){
    return {domain:'TARGET_TECH',evidence:targetEvidence}
  }

  if(physicalEvidence.length>=2&&physicalEvidence.length>=targetEvidence.length){
    return {domain:'NON_TARGET_PHYSICAL',evidence:physicalEvidence}
  }

  if(targetEvidence.length>=2){
    return {domain:'TARGET_TECH',evidence:targetEvidence}
  }

  if(functionalEvidence.length>=2&&targetEvidence.length<2){
    return {domain:'NON_TARGET_FUNCTIONAL',evidence:functionalEvidence}
  }

  return {domain:'AMBIGUOUS',evidence:[...targetEvidence,...physicalEvidence,...functionalEvidence]}
}
