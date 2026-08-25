function norm(value=''){
  return String(value??'')
    .toLowerCase()
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim()
}

const DOMAIN_NON_TARGET_TITLE_RULES=[
  {reason:'Director-level roles are outside the target hands-on delivery level',rx:/\bdirector\b/i},
  {reason:'People-management-first role is outside the target hands-on delivery family',rx:/\bpeople\s*(?:&|and)\s*project manager\b|\bpeople manager\b/i},
  {reason:'ERP-specialist project management is outside the target general IT delivery family',rx:/\b(?:microsoft\s+)?d365\b.{0,60}\bproject manager\b|\bdynamics 365\b.{0,60}\bproject manager\b|\bsap\b.{0,80}\bproject manager\b|\bs\/?4hana\b.{0,80}\bproject manager\b/i},
  {reason:'Content/marketing project delivery is outside the target IT delivery family',rx:/\b(?:digital|web)?\s*content project manager\b/i},
  {reason:'New product development is outside the target enterprise IT delivery family',rx:/\bnew product development project manager\b|\bnpd project manager\b/i},
  {reason:'Hardware product delivery is outside the target enterprise IT delivery family',rx:/\bhardware project (?:lead|manager)\b/i},
]

const NON_TARGET_TITLE_RULES=[
  {reason:'Engineering management is a different profession',rx:/\bengineering manager\b|\bsoftware engineering manager\b|\bmanager\b.{0,6}\bsoftware engineering\b|\bsoftware engineering\b.{0,20}\bvice president\b|\bvice president\b.{0,20}\bsoftware engineering\b/i},
  {reason:'Hands-on engineering role',rx:/\bengineer\b/i},
  {reason:'Architecture role',rx:/\barchitect\b/i},
  {reason:'Product management is outside the target delivery role family',rx:/\bproduct manager\b|\bproduct owner\b/i},
  {reason:'Business relationship / partner role is outside the target delivery role family',rx:/\bbusiness relationship manager\b|\bbusiness partner\b/i},
  {reason:'Specialist role is outside the target delivery role family',rx:/\bdigital innovation specialist\b/i},
  {reason:'Stream/product ownership is outside the target project/delivery role family',rx:/\b(?:revenue\s+)?stream owner\b/i},
]

const TARGET_TITLE_RULES=[
  /\bproject manager\b/i,
  /\bprojektleder\b/i,
  /\bproject lead\b/i,
  /\bdelivery manager\b/i,
  /\bdelivery lead\b/i,
  /\bprogram(?:me)? manager\b/i,
  /\bprogram(?:me)? lead\b/i,
  /\bimplementation (?:manager|lead)\b/i,
  /\bintegration (?:manager|lead)\b/i,
  /\btransformation (?:manager|lead)\b/i,
  /\bexecution lead\b/i,
  /\b(?:lead|manager)\b.{0,30}\bpmo\b|\bpmo\b.{0,30}\b(?:lead|manager)\b/i,
]

const TECH_SCOPE_CATEGORIES={
  enterprise_it:/\b(?:enterprise|corporate|group) it\b|\binformation technology\b|\bit systems?\b/i,
  software:/\bsoftware\b|\benterprise software\b/i,
  enterprise_systems:/\b(?:enterprise|business) systems?\b|\benterprise applications?\b|\bbusiness applications?\b/i,
  platform:/\b(?:enterprise|technology|data|cloud|digital) platform\b|\bplatform migration\b/i,
  cloud:/\bcloud\b|\bazure\b|\baws\b/i,
  data:/\bdata (?:platform|warehouse|migration|engineering|transformation)\b|\bdwh\b|\bpower bi\b/i,
  integration:/\bsystems? integration\b|\bintegration (?:project|programme|program|platform|workstream)\b|\bapi(?:s)?\b/i,
  transformation:/\b(?:digital|technology|it|enterprise|data) transformation\b/i,
  enterprise_apps:/\berp\b|\bd365\b|\bdynamics 365\b|\bsap\b/i,
  ai_delivery:/\bai (?:strategy|transformation|implementation|platform|programme|program|delivery)\b/i,
}

const ENTERPRISE_IT_ANCHORS={
  org_it:/\b(?:enterprise|corporate|group) it\b|\binformation technology\b|\bit organisation\b|\bit organization\b/i,
  enterprise_apps:/\benterprise applications?\b|\bbusiness applications?\b|\bbusiness systems?\b|\benterprise systems?\b/i,
  enterprise_platform:/\b(?:enterprise|technology|data|cloud|digital) platform\b|\bplatform migration\b/i,
  integration:/\bsystems? integration\b|\bintegration (?:project|programme|program|platform|workstream)\b/i,
  transformation:/\b(?:digital|technology|it|enterprise|data) transformation\b/i,
  cloud_data:/\b(?:cloud|data) migration\b|\bdata warehouse\b|\bdwh\b|\bpower bi\b/i,
}

const NON_ENTERPRISE_DOMAIN_CATEGORIES={
  physical_product:/\b(?:embedded software|embedded systems?|hardware|sensor(?:s)?|camera(?:s)?|device(?:s)?|physical product|product engineering)\b/i,
  scientific_environmental:/\b(?:bird monitoring|wildlife|environmental|marine|ecology|scientist(?:s)?|scientific|survey(?:s)?)\b/i,
  field_offshore:/\b(?:offshore|field installation|site installation|field campaign(?:s)?|marine survey(?:s)?|commissioning on site)\b/i,
  industrial_delivery:/\b(?:manufacturing line|plant equipment|mechanical|electrical equipment|industrial equipment|fabrication|procurement of equipment)\b/i,
}

const PRIMARY_ENTERPRISE_DELIVERY_OBJECT_PATTERNS=[
  /\b(?:deliver|delivery of|implement|implementation of|migrate|migration of|replace|moderni[sz]e|transform|roll out|rollout|deploy|upgrade)\b.{0,90}\b(?:enterprise software|software platform|enterprise applications?|business applications?|business systems?|it systems?|technology platform|data platform|cloud platform|digital platform|it infrastructure|cloud infrastructure|network infrastructure|cloud services?|workplace platforms?)\b/i,
  /\b(?:enterprise software|software platform|enterprise applications?|business applications?|business systems?|it systems?|technology platform|data platform|cloud platform|digital platform|it infrastructure|cloud infrastructure|network infrastructure|cloud services?|workplace platforms?)\b.{0,90}\b(?:delivery|implementation|migration|transformation|rollout|deployment|cutover|go[- ]live|project|programme|program)\b/i,
  /\b(?:group it|corporate it|enterprise it|information technology)\b.{0,120}\b(?:deliver|delivery|implementation|migration|platform|applications?|systems?|infrastructure|services?)\b/i,
]

const HARD_NON_IT_DELIVERY_OBJECT_CATEGORIES={
  built_environment:/\b(?:built environment|building permitting|construction programme|construction program|civil(?:\s*\/|,)?\s*structural|architectural(?:\s*\/|,)?\s*mechanical|mechanical(?:\s*\/|,)?\s*electrical|facility delivery|completed facility|data cent(?:er|re) projects?)\b/i,
  plant_equipment:/\bplant\s*(?:&|and)\s*equipment solutions?\b|\bmajor equipment(?: deliveries?)?\b|\bprocess[- ]line deliveries\b|\b(?:eps|epc) projects?\b|\bplant engineering\b|\bindustrial equipment\b|\bcomplete plant solutions?\b/i,
}

const PRIMARY_PHYSICAL_DELIVERY_OBJECT_PATTERNS=[
  /\b(?:deliver|delivery of|customer acceptance of|handover of)\b.{0,100}\b(?:wildlife monitoring systems?|bird monitoring systems?|monitoring systems?|sensor systems?|hardware(?: and software)? integrated systems?|industrial equipment|plant equipment|production equipment|manufacturing lines?|physical products?|facilit(?:y|ies)|buildings?|data cent(?:er|re) projects?|industrial projects?)\b/i,
  /\b(?:hardware suppliers?|installation contractors?|commissioning personnel|field installation|site installation|factory acceptance testing|fat\s*\/?\s*sat|commissioning and handover|installation and commissioning)\b/i,
  /\b(?:built environment|building permitting|construction programme|construction program|civil,? structural|architectural,? mechanical|mechanical,? electrical|contractors? and site teams?)\b/i,
  /\b(?:offshore wind|offshore energy|marine systems?|oil\s*&\s*gas|industrial automation)\b.{0,120}\b(?:delivery|projects?|installation|commissioning|systems?)\b|\b(?:delivery|projects?|installation|commissioning|systems?)\b.{0,120}\b(?:offshore wind|offshore energy|marine systems?|oil\s*&\s*gas|industrial automation)\b/i,
]

function matchedPatterns(value,patterns){
  const text=norm(value)
  return patterns.filter(rx=>rx.test(text)).length
}

function primaryDeliveryObjectDecision(text){
  const enterprise=matchedPatterns(text,PRIMARY_ENTERPRISE_DELIVERY_OBJECT_PATTERNS)
  const physical=matchedPatterns(text,PRIMARY_PHYSICAL_DELIVERY_OBJECT_PATTERNS)
  const hardNonIt=matchedCategories(text,HARD_NON_IT_DELIVERY_OBJECT_CATEGORIES)
  if(hardNonIt.length>0 && enterprise===0){
    return {pass:false,enterprise,physical,hardNonIt,reason:'Primary delivery object is construction / facility / plant / equipment rather than enterprise IT'}
  }
  if(physical>=2 && enterprise===0){
    return {pass:false,enterprise,physical,hardNonIt,reason:'Primary delivery object is physical / field / industrial rather than enterprise IT'}
  }
  return {pass:true,enterprise,physical,hardNonIt,reason:null}
}

const DELIVERY_CATEGORIES={
  ownership:/\bend[- ]to[- ]end\b|\bown(?:s|ed|ing)?\b.{0,45}\b(?:delivery|project|programme|program|scope|timeline|budget|implementation|migration)\b|\bresponsible for\b.{0,55}\b(?:delivery|project|programme|program|implementation)\b/i,
  scope_plan:/\b(?:scope|timeline|timelines|milestone|milestones|project plan|delivery plan|schedule|schedules)\b/i,
  risk_dependencies:/\brisks?\b|\bdependencies\b|\braid\b/i,
  lifecycle:/\bimplementation\b|\bmigration\b|\brelease readiness\b|\brelease\b|\bcutover\b|\bgo[- ]live\b|\bhandover\b|\btransition\b/i,
  governance:/\bgovernance\b|\bsteerco\b|\bsteering committee\b|\bsenior stakeholders?\b|\bexecutive stakeholders?\b/i,
  cross_functional:/\bcross[- ]functional\b|\bacross business and (?:technology|engineering)\b|\bbusiness and technology teams\b/i,
  roadmap:/\broadmap\b|\bprioriti[sz]ation\b/i,
}

function matchedCategories(value,categories){
  const text=norm(value)
  return Object.entries(categories).filter(([,rx])=>rx.test(text)).map(([name])=>name)
}

export function classifyRoleTitle(title=''){
  const value=norm(title)
  for(const rule of DOMAIN_NON_TARGET_TITLE_RULES){
    if(rule.rx.test(value)) return {kind:'exclude',reason:rule.reason}
  }
  if(TARGET_TITLE_RULES.some(rx=>rx.test(value))) return {kind:'target',reason:'Title belongs to the project/delivery role family'}
  for(const rule of NON_TARGET_TITLE_RULES){
    if(rule.rx.test(value)) return {kind:'exclude',reason:rule.reason}
  }
  return {kind:'ambiguous',reason:'Role title requires JD verification'}
}

export function roleGate(job={}){
  const title=String(job?.title??'')
  const description=String(job?.description??'')
  const titleDecision=classifyRoleTitle(title)
  if(titleDecision.kind==='exclude'){
    return {pass:false,reason:titleDecision.reason,titleKind:'exclude',techSignals:0,deliverySignals:0}
  }

  const text=`${title}\n${description}`
  const tech=matchedCategories(text,TECH_SCOPE_CATEGORIES)
  const delivery=matchedCategories(text,DELIVERY_CATEGORIES)
  const enterpriseAnchors=matchedCategories(text,ENTERPRISE_IT_ANCHORS)
  const nonEnterpriseDomains=matchedCategories(text,NON_ENTERPRISE_DOMAIN_CATEGORIES)
  const primaryObject=primaryDeliveryObjectDecision(text)
  const hasLifecycleOrOwnership=delivery.includes('lifecycle')||delivery.includes('ownership')

  if(!primaryObject.pass){
    return {pass:false,reason:primaryObject.reason,titleKind:titleDecision.kind,techSignals:tech.length,deliverySignals:delivery.length,primaryEnterpriseSignals:primaryObject.enterprise,primaryPhysicalSignals:primaryObject.physical}
  }

  if(titleDecision.kind==='target'){
    if(nonEnterpriseDomains.length>=2 && enterpriseAnchors.length===0){
      return {pass:false,reason:'Project title is anchored in a non-enterprise physical/scientific/industrial delivery domain rather than enterprise IT',titleKind:'target',techSignals:tech.length,deliverySignals:delivery.length}
    }
    if(tech.length<1){
      return {pass:false,reason:'Target title lacks verified enterprise IT / software / digital technology scope in the JD',titleKind:'target',techSignals:tech.length,deliverySignals:delivery.length}
    }
    if(delivery.length<2){
      return {pass:false,reason:'Target title lacks enough project/delivery ownership evidence in the JD',titleKind:'target',techSignals:tech.length,deliverySignals:delivery.length}
    }
    return {pass:true,reason:'Target project/delivery title with verified technology delivery scope',titleKind:'target',techSignals:tech.length,deliverySignals:delivery.length}
  }

  if(tech.length<2 || delivery.length<3 || !hasLifecycleOrOwnership){
    return {pass:false,reason:'Ambiguous title lacks strong enterprise technology project/delivery evidence',titleKind:'ambiguous',techSignals:tech.length,deliverySignals:delivery.length}
  }
  return {pass:true,reason:'Ambiguous title is supported by strong enterprise technology delivery evidence in the JD',titleKind:'ambiguous',techSignals:tech.length,deliverySignals:delivery.length}
}
