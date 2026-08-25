import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRoleTitle } from './linkedin-role-gate.js'

const obviousNonTargetTitles=[
  'Senior Engineering Manager - Decision Intelligence',
  'AI/ML Technical Architect Lead',
  'Principal Software Engineering Manager',
  'Technical Support Engineer - E-mobility',
  'Technical Lead Data & Platform Engineer',
  'Portfolio Architect',
  'Senior Innovation Business Partner',
  'Business Relationship Manager Associate Director - Nordic Business Unit',
  'Manager, Software Engineering',
  'Senior Quantum Software Engineer - Bring-up Software Infrastructure',
  'Forward Deployed Engineer | Merchandising',
  'Engineering Manager – Cloud, AI, and Enterprise Software at Scale – Corporate Actions',
  'Senior Vice President - Software Engineering',
  'Senior Digital Innovation Specialist',
  'IT Product Manager - Manufacturing',
  'Assoc Director AI Product Manager',
  'Senior Value Engineer',
]

test('obvious non-project/delivery professions are rejected by title before JD fetching',()=>{
  for(const title of obviousNonTargetTitles){
    const decision=classifyRoleTitle(title)
    assert.equal(decision.kind,'exclude',`${title} should be excluded, got ${decision.kind}`)
  }
})

const clearTargetTitles=[
  'AWS Migration Project Manager – VDI, Data & Platform Migration',
  'Senior IT Project Manager',
  'Senior Project Manager, Falcom',
  'Lead Transformation PMO – AI strategy implementation',
  'Integration Project Manager',
  'IT Delivery Lead',
  'Senior Software Program Manager, Strategic Programs & Projects',
  'Customer Project Manager',
  'Technical Project Manager',
  'Software Execution Lead',
]

test('clear project/delivery role families remain eligible for JD verification',()=>{
  for(const title of clearTargetTitles){
    const decision=classifyRoleTitle(title)
    assert.equal(decision.kind,'target',`${title} should be target, got ${decision.kind}`)
  }
})

const domainSpecificNonTargets=[
  'Digital Content Project Manager',
  'Web Content Project Manager (Maternity Cover)',
  'New Product Development Project Manager (F-M)',
  'Hardware Project Lead',
]

test('project-like titles in explicitly excluded content, NPD and hardware domains are rejected',()=>{
  for(const title of domainSpecificNonTargets){
    const decision=classifyRoleTitle(title)
    assert.equal(decision.kind,'exclude',`${title} should be excluded, got ${decision.kind}`)
  }
})

test('borderline manager/specialist titles stay ambiguous rather than being thrown away by title alone',()=>{
  const titles=[
    'Business Application Manager',
    'Senior Project Specialist within Finance & Digital Development',
    'Senior Manager, Portfolio & Performance Management, Global Operations',
    'Revenue Stream Owner of HXM Implementation',
    'Senior Onboarding consultant',
  ]
  for(const title of titles){
    const decision=classifyRoleTitle(title)
    assert.equal(decision.kind,'ambiguous',`${title} should be ambiguous, got ${decision.kind}`)
  }
})

import { roleGate } from './linkedin-role-gate.js'

const strongEnterpriseDelivery=`
Lead end-to-end enterprise IT and software delivery across business and engineering teams.
Own scope, timeline, milestones, risks, dependencies and governance for a platform migration.
Drive systems integration, implementation, release readiness, cutover and go-live with senior stakeholders.
`

test('clear target title passes only when the JD confirms technology delivery ownership',()=>{
  const good=roleGate({title:'Senior Project Manager',description:strongEnterpriseDelivery})
  assert.equal(good.pass,true)

  const nonTech=roleGate({
    title:'Project Manager',
    description:'Lead construction site activities, contractors, building schedules, safety inspections and civil works for a new facility.',
  })
  assert.equal(nonTech.pass,false)
  assert.match(nonTech.reason,/technology|IT|digital/i)
})

test('ambiguous titles need stronger JD proof than clear project/delivery titles',()=>{
  const applicationManager=roleGate({
    title:'Business Application Manager',
    description:'Own enterprise applications and business systems roadmap. Lead platform implementation and systems integration, manage risks and dependencies, coordinate senior stakeholders, release readiness and go-live.',
  })
  assert.equal(applicationManager.pass,true)

  const onboardingConsultant=roleGate({
    title:'Senior Onboarding consultant',
    description:'Guide customers through onboarding, training sessions, product adoption, configuration questions and ongoing customer relationship activities.',
  })
  assert.equal(onboardingConsultant.pass,false)
})

test('explicit non-target profession stays rejected even when its JD contains generic delivery language',()=>{
  const result=roleGate({
    title:'Principal Software Engineering Manager',
    description:strongEnterpriseDelivery+' Manage software engineers, architecture and development quality.',
  })
  assert.equal(result.pass,false)
  assert.equal(result.titleKind,'exclude')
})

test('borderline technology manager without real project delivery ownership is rejected',()=>{
  const result=roleGate({
    title:'Manager, Tax Technology',
    description:'Own tax technology tools, provide subject matter expertise, advise stakeholders, support reporting and maintain technology processes.',
  })
  assert.equal(result.pass,false)
})

test('engineering context does not override an explicit project/program delivery profession',()=>{
  const titles=[
    'Project Manager, Software Engineering Transformation',
    'Engineering Project Manager',
    'Software Engineering Program Manager',
  ]
  for(const title of titles){
    const decision=classifyRoleTitle(title)
    assert.equal(decision.kind,'target',`${title} should stay in target role family, got ${decision.kind}`)
  }
})
