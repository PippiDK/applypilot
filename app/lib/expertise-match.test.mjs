import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateExpertise,matchRequirementEvidence} from './expertise-match.js'

const req=(overrides={})=>({
  id:'r1',
  capability:'End-to-end delivery',
  category:'delivery_execution',
  importance:'core',
  requirement:'Lead end-to-end delivery.',
  minimumYears:0,
  directEvidenceTerms:['end-to-end delivery'],
  transferableEvidenceTerms:['project delivery'],
  jdEvidence:['Lead end-to-end delivery.'],
  ...overrides
})

test('classifies direct CV evidence as MATCHED and transferable evidence only as PARTIAL',()=>{
  assert.equal(matchRequirementEvidence(req(), 'Senior manager with end-to-end delivery ownership.').status,'MATCHED')
  assert.equal(matchRequirementEvidence(req(), 'Senior manager with complex project delivery ownership.').status,'PARTIAL')
  assert.equal(matchRequirementEvidence(req(), 'Senior museum curator and exhibition planner.').status,'NOT_EVIDENCED')
})

test('a minimum-years requirement is not fully matched unless duration is evidenced for the same capability',()=>{
  const requirement=req({
    capability:'5+ years Data & AI initiative leadership',
    category:'required_experience_qualifications',
    importance:'critical',
    minimumYears:5,
    directEvidenceTerms:['Data & AI initiatives','AI initiatives'],
    transferableEvidenceTerms:['data initiatives']
  })
  assert.equal(matchRequirementEvidence(requirement,'Led AI initiatives across the enterprise.').status,'PARTIAL')
  assert.equal(matchRequirementEvidence(requirement,'More than 6 years leading AI initiatives across the enterprise.').status,'MATCHED')
  assert.equal(matchRequirementEvidence(requirement,'18+ years in IT. Led AI initiatives last year.').status,'PARTIAL')
})

test('calculates Expertise Match only from professional requirements and returns the five approved breakdown dimensions',()=>{
  const requirements=[
    req({id:'delivery',importance:'core'}),
    req({id:'domain',capability:'Financial IT',category:'domain_functional_expertise',importance:'core',directEvidenceTerms:['financial IT'],transferableEvidenceTerms:['regulated enterprise']}),
    req({id:'technical',capability:'Generative AI',category:'technical_platform_capabilities',importance:'critical',directEvidenceTerms:['Generative AI'],transferableEvidenceTerms:['data platform']}),
    req({id:'leadership',capability:'Senior stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',directEvidenceTerms:['senior stakeholders'],transferableEvidenceTerms:['stakeholder management']}),
    req({id:'qualification',capability:'PMP certification',category:'required_experience_qualifications',importance:'supporting',directEvidenceTerms:['PMP'],transferableEvidenceTerms:[]})
  ]
  const result=evaluateExpertise(requirements,'Senior IT leader with end-to-end delivery, financial IT, senior stakeholders and data platform experience.')
  assert.ok(result.expertiseMatch>0&&result.expertiseMatch<100)
  assert.deepEqual(Object.keys(result.breakdown),[
    'delivery_execution','domain_functional_expertise','technical_platform_capabilities','leadership_stakeholder_scope','required_experience_qualifications'
  ])
  assert.equal(result.requirements.find(x=>x.id==='technical').status,'PARTIAL')
  assert.equal(result.requirements.find(x=>x.id==='qualification').status,'NOT_EVIDENCED')
})

test('critical missing expertise has more scoring impact than an otherwise identical supporting gap',()=>{
  const matched=req({id:'matched',importance:'core'})
  const criticalMissing=req({id:'gap',capability:'Specialist AI',importance:'critical',directEvidenceTerms:['specialist AI'],transferableEvidenceTerms:[]})
  const supportingMissing={...criticalMissing,importance:'supporting'}
  const cv='Strong end-to-end delivery experience across complex enterprise technology programmes and cross-functional teams.'
  const withCritical=evaluateExpertise([matched,criticalMissing],cv)
  const withSupporting=evaluateExpertise([matched,supportingMissing],cv)
  assert.ok(withCritical.expertiseMatch<withSupporting.expertiseMatch)
})

test('Why you fit contains strongest evidenced capabilities and Expertise gaps prioritise critical missing evidence',()=>{
  const requirements=[
    req({id:'delivery',capability:'End-to-end complex delivery',importance:'core'}),
    req({id:'stake',capability:'Senior stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',directEvidenceTerms:['executive reporting'],transferableEvidenceTerms:['stakeholder management']}),
    req({id:'ai',capability:'ML / Generative AI delivery',category:'technical_platform_capabilities',importance:'critical',directEvidenceTerms:['Generative AI','Machine Learning'],transferableEvidenceTerms:['data platform']}),
    req({id:'rai',capability:'Responsible AI',category:'domain_functional_expertise',importance:'core',directEvidenceTerms:['Responsible AI'],transferableEvidenceTerms:[]})
  ]
  const result=evaluateExpertise(requirements,'Led end-to-end delivery with executive reporting and enterprise data platforms.')
  assert.ok(result.whyYouFit.some(x=>/End-to-end complex delivery/i.test(x)))
  assert.match(result.expertiseGaps[0],/ML \/ Generative AI delivery/i)
  assert.ok(result.expertiseGaps.every(x=>/Source CV/i.test(x)))
})

test('compound OR requirement matches when any acceptable alternative is evidenced',()=>{
  const requirement=req({
    capability:'Relevant AI, analytics, product, consulting, or program experience',
    category:'domain_functional_expertise',
    importance:'core',
    evidenceRule:'any_group',
    evidenceGroups:[
      {label:'AI',directEvidenceTerms:['AI','artificial intelligence'],transferableEvidenceTerms:[]},
      {label:'analytics',directEvidenceTerms:['analytics','BI','business intelligence','Power BI','Data Warehouse','DWH'],transferableEvidenceTerms:['data platform']},
      {label:'product',directEvidenceTerms:['product management','product manager'],transferableEvidenceTerms:['Product Owner']},
      {label:'consulting',directEvidenceTerms:['consulting','consultant'],transferableEvidenceTerms:[]},
      {label:'program',directEvidenceTerms:['program management','programme management','program manager','programme manager'],transferableEvidenceTerms:['project management']}
    ],
    directEvidenceTerms:['AI','analytics','product management','consulting','program management'],
    transferableEvidenceTerms:['data platform','project management']
  })
  const cv='Led Data Warehouse and BI initiatives and improved Power BI reporting across a regulated enterprise.'
  const result=matchRequirementEvidence(requirement,cv)
  assert.equal(result.status,'MATCHED')
})

test('compound AND requirement gives PARTIAL when Source CV evidences some but not all required capability groups',()=>{
  const requirement=req({
    capability:'Cross-functional Data and AI initiative leadership',
    category:'domain_functional_expertise',
    importance:'critical',
    evidenceRule:'all_groups',
    evidenceGroups:[
      {label:'data',directEvidenceTerms:['data initiatives','Data Warehouse','DWH','BI','data platform'],transferableEvidenceTerms:[]},
      {label:'AI',directEvidenceTerms:['AI initiatives','artificial intelligence','machine learning','Generative AI'],transferableEvidenceTerms:[]},
      {label:'initiative leadership',directEvidenceTerms:['led cross-functional','cross-functional delivery','initiative leadership'],transferableEvidenceTerms:['stakeholder management']}
    ],
    directEvidenceTerms:['Data and AI initiatives'],
    transferableEvidenceTerms:['data initiatives','cross-functional delivery']
  })
  const cv='Led cross-functional delivery across Data Warehouse and BI initiatives with senior stakeholders.'
  const result=matchRequirementEvidence(requirement,cv)
  assert.equal(result.status,'PARTIAL')
  assert.match(result.reason,/some required capability groups/i)
})

test('relevant business or technical education recognizes documented business degrees',()=>{
  const requirement=req({
    capability:'Education in a relevant business or technical discipline',
    category:'required_experience_qualifications',
    importance:'core',
    evidenceRule:'any_group',
    evidenceGroups:[
      {label:'business discipline',directEvidenceTerms:['business','finance','accounting','economics','management','auditing'],transferableEvidenceTerms:[]},
      {label:'technical discipline',directEvidenceTerms:['computer science','engineering','information technology','IT degree'],transferableEvidenceTerms:[]}
    ],
    directEvidenceTerms:['business degree','technical degree'],
    transferableEvidenceTerms:[]
  })
  const cv='Master of Science in Accounting & Auditing, Taxes & Taxation. Bachelor’s Degree in Accounting and Finance.'
  assert.equal(matchRequirementEvidence(requirement,cv).status,'MATCHED')
})

test('Novo-style AI Product Manager fixture credits real delivery, data, leadership and education while preserving AI gaps',()=>{
  const requirements=[
    req({id:'delivery-governance',capability:'Delivery governance, planning, and risk management',category:'delivery_execution',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'delivery governance',directEvidenceTerms:['delivery governance','project governance','risk and dependency management'],transferableEvidenceTerms:['governance']}],directEvidenceTerms:['delivery governance'],transferableEvidenceTerms:['governance']}),
    req({id:'cross-functional',capability:'Complex cross-functional initiative delivery',category:'delivery_execution',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'cross-functional delivery',directEvidenceTerms:['cross-functional delivery','complex cross-functional initiatives','cross-functional teams'],transferableEvidenceTerms:['cross-team coordination']}],directEvidenceTerms:['cross-functional delivery'],transferableEvidenceTerms:['cross-team coordination']}),
    req({id:'stakeholders',capability:'Senior executive and business leader partnership',category:'leadership_stakeholder_scope',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'senior stakeholders',directEvidenceTerms:['senior stakeholders','executive reporting','executive-level reporting'],transferableEvidenceTerms:['stakeholder management']}],directEvidenceTerms:['senior stakeholders'],transferableEvidenceTerms:['stakeholder management']}),
    req({id:'team-leadership',capability:'Team leadership and capability development',category:'leadership_stakeholder_scope',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'team leadership',directEvidenceTerms:['built, coached, and scaled','team leadership','led and coordinated a distributed cross-functional team'],transferableEvidenceTerms:['cross-team coordination']}],directEvidenceTerms:['team leadership'],transferableEvidenceTerms:['cross-team coordination']}),
    req({id:'education',capability:'Education in a relevant business or technical discipline',category:'required_experience_qualifications',importance:'core',evidenceRule:'any_group',evidenceGroups:[{label:'business discipline',directEvidenceTerms:['accounting','finance','economics','business','management','auditing'],transferableEvidenceTerms:[]},{label:'technical discipline',directEvidenceTerms:['computer science','engineering','information systems','data science'],transferableEvidenceTerms:[]}],directEvidenceTerms:['accounting','finance','engineering','computer science'],transferableEvidenceTerms:[]}),
    req({id:'alt-experience',capability:'2+ years consulting, AI transformation, AI delivery, analytics, product management, or program leadership',category:'required_experience_qualifications',importance:'core',minimumYears:2,evidenceRule:'any_group',evidenceGroups:[{label:'analytics',directEvidenceTerms:['BI','Data Warehouse','DWH','analytics'],transferableEvidenceTerms:['data platform']},{label:'program leadership',directEvidenceTerms:['programme','program leadership','program manager'],transferableEvidenceTerms:['project delivery']},{label:'AI',directEvidenceTerms:['AI transformation','AI delivery'],transferableEvidenceTerms:[]},{label:'product',directEvidenceTerms:['product management','product manager'],transferableEvidenceTerms:['Product Owners']}],directEvidenceTerms:['BI','Data Warehouse','programme','AI delivery','product management'],transferableEvidenceTerms:['data platform','project delivery']}),
    req({id:'data-ai-5y',capability:'5+ years Data & AI initiative leadership',category:'required_experience_qualifications',importance:'critical',minimumYears:5,evidenceRule:'all_groups',evidenceGroups:[{label:'data',directEvidenceTerms:['Data / DWH / BI Initiatives','Data Warehouse','DWH','BI initiatives'],transferableEvidenceTerms:['data platform']},{label:'AI',directEvidenceTerms:['AI initiatives','artificial intelligence'],transferableEvidenceTerms:[]},{label:'leadership',directEvidenceTerms:['led cross-functional delivery','led end-to-end delivery','initiative leadership'],transferableEvidenceTerms:['stakeholder management']}],directEvidenceTerms:['Data & AI initiatives','AI initiatives'],transferableEvidenceTerms:['Data Warehouse','cross-functional delivery']}),
    req({id:'data-ai-solutions',capability:'Data, Analytics, Machine Learning, or Generative AI solution delivery',category:'technical_platform_capabilities',importance:'core',evidenceRule:'any_group',evidenceGroups:[{label:'Data',directEvidenceTerms:['data platform','data platforms','data delivery'],transferableEvidenceTerms:['Data Warehouse','DWH']},{label:'Analytics',directEvidenceTerms:['BI','Power BI','analytics'],transferableEvidenceTerms:['reporting']},{label:'ML',directEvidenceTerms:['Machine Learning','ML delivery'],transferableEvidenceTerms:[]},{label:'GenAI',directEvidenceTerms:['Generative AI','GenAI'],transferableEvidenceTerms:[]}],directEvidenceTerms:['data platform','BI','Machine Learning','Generative AI'],transferableEvidenceTerms:['Data Warehouse','reporting']}),
    req({id:'strategy-roadmap',capability:'Enterprise-scale data strategies and AI roadmaps',category:'domain_functional_expertise',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'data strategy',directEvidenceTerms:['data strategy','data roadmap'],transferableEvidenceTerms:['data platform','Data Warehouse']},{label:'AI roadmap',directEvidenceTerms:['AI roadmap','AI strategy'],transferableEvidenceTerms:[]}],directEvidenceTerms:['data strategy','AI roadmap'],transferableEvidenceTerms:['data platform']}),
    req({id:'ai-product',capability:'AI Product Management / AI product development leadership',category:'domain_functional_expertise',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'AI product',directEvidenceTerms:['AI product management','AI product development'],transferableEvidenceTerms:['Product Owners']}],directEvidenceTerms:['AI product management'],transferableEvidenceTerms:['Product Owners']}),
    req({id:'responsible-ai',capability:'Responsible AI',category:'technical_platform_capabilities',importance:'core',evidenceRule:'all_groups',evidenceGroups:[{label:'Responsible AI',directEvidenceTerms:['Responsible AI','ethical AI'],transferableEvidenceTerms:['data governance']}],directEvidenceTerms:['Responsible AI'],transferableEvidenceTerms:['data governance']})
  ]

  const cv=`Senior IT Project and Delivery Manager with 18+ years of experience in regulated enterprise environments. Strong background in data platforms, BI, automation, governance and cross-functional delivery.
Core Competences: End-to-End Project Delivery. Complex Cross-functional Initiatives. Project Governance. Stakeholder Management. Executive Reporting. Risk & Dependency Management. Data / DWH / BI Initiatives. Enterprise Platforms.
Led end-to-end delivery of a large-scale enterprise software platform programme. Accountable for full lifecycle execution over 3.5 years. Established infrastructure, data platforms and a structured governance framework. Led and coordinated a distributed cross-functional team of 15+ specialists. Owned roadmap governance, budget control, proactive risk and dependency management, and executive-level reporting. Built, coached, and scaled high-performing international project teams.
Led end-to-end Financial IT delivery with cross-functional teams of 25+ specialists. Improved BI and reporting stability. Led regulatory reporting and AML initiatives. Partnered with Product Owners and Business Analysts.
Led quality assurance across Data Warehouse (DWH), BI, Compliance and Regulatory Reporting systems.
Harvard Business School Online, Specialization in Leadership & Management. Master of Science in Accounting & Auditing, Taxes & Taxation. Bachelor's Degree in Accounting and Finance. Tools include MS SQL, Data Warehouse and Power BI.`

  const result=evaluateExpertise(requirements,cv)
  assert.ok(result.expertiseMatch>=40&&result.expertiseMatch<=80,`unexpected Novo-style Expertise Match ${result.expertiseMatch}%`)
  assert.ok(result.breakdown.delivery_execution.score>=75)
  assert.ok(result.breakdown.leadership_stakeholder_scope.score>=75)
  assert.ok(result.breakdown.technical_platform_capabilities.score>0)
  assert.ok(result.breakdown.required_experience_qualifications.score>0)
  assert.equal(result.requirements.find(x=>x.id==='education').status,'MATCHED')
  assert.equal(result.requirements.find(x=>x.id==='data-ai-5y').status,'PARTIAL')
  assert.equal(result.requirements.find(x=>x.id==='responsible-ai').status,'NOT_EVIDENCED')
  assert.ok(result.whyYouFit.some(x=>/education|delivery|executive|team/i.test(x)))
})

test('minimum years can be evidenced from dated CV employment sections containing the matched capability',()=>{
  const requirement=req({
    capability:'2+ years analytics experience',
    category:'required_experience_qualifications',
    importance:'core',
    minimumYears:2,
    evidenceRule:'any_group',
    evidenceGroups:[{label:'analytics',directEvidenceTerms:['BI','Data Warehouse','DWH'],transferableEvidenceTerms:[]}],
    directEvidenceTerms:['BI','Data Warehouse','DWH'],
    transferableEvidenceTerms:[]
  })
  const cv=`Professional Experience
Senior Test Manager, Example Bank | Copenhagen May 2009 — Nov 2019
Led quality assurance across Data Warehouse (DWH), BI, and reporting systems.
Education
Master of Science in Finance`
  assert.equal(matchRequirementEvidence(requirement,cv).status,'MATCHED')
})
