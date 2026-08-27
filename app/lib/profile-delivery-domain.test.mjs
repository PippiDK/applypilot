import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyDeliveryDomain} from './profile-delivery-domain.js'

const classify=(title,description)=>classifyDeliveryDomain({title,description})

const cases=[
  ['explicit IT delivery','Senior IT Project Manager','Lead enterprise IT systems, software platforms, integrations, APIs and cloud delivery.','TARGET_TECH'],
  ['Danish digitalisation','Erfaren projektleder søges til kliniknær digitalisering','Drive digitalisering, digitale løsninger, IT-systemer, integrationer og tekniske leverancer.','TARGET_TECH'],
  ['Atea Danish IT delivery','Senior IT-projektledere med teknisk indsigt','Atea søger senior IT-projektledere til komplekse kundeinitiativer og større IT-leverancer. Du leder tekniske projektteams, styrer projektledelse, afhængigheder, milepæle og leverancer på tværs af IT-systemer og platforme.','TARGET_TECH'],
  ['PET Danish strategic IT delivery','Kan du drive succesfulde strategiske IT projekter i PET?','Som vores nye IT-projektleder driver du komplekse strategiske IT-projekter. Du har erfaring med IT-projektledelse og Scrum Master-arbejde og skaber fremdrift, koordinering og leverancer mellem tekniske teams og forretningen.','TARGET_TECH'],
  ['integration delivery','Integration Project Manager','Lead API, middleware, interfaces, SaaS and enterprise application integrations.','TARGET_TECH'],
  ['data platform','Senior Project Manager – Data Platform Modernisation','Lead cloud data platform, data warehouse, analytics, Azure migration and technology delivery.','TARGET_TECH'],
  ['OT security project','Senior SCADA & OT Security Package/Project Manager','Lead SCADA and OT security systems delivery, cyber controls and platform integration.','TARGET_TECH'],
  ['roads and highways','Senior Project Manager - Roads and Highways','Lead roads, highways, civil engineering, construction, contractors and site works.','NON_TARGET_PHYSICAL'],
  ['mechanical construction beats incidental tech','Senior Mechanical Construction Project Manager - Data Centres','Own mechanical construction, HVAC, site works, contractors and installation. Coordinate BMS, SCADA, OT systems and integrations during commissioning.','NON_TARGET_PHYSICAL'],
  ['Danish utility construction','Teknisk projektleder til detailprojektering og entreprisestyring af 10/0,4 kV projekter','Ansvar for detailprojektering, entreprisestyring, el-anlæg, byggeplads, installation og fysisk udførelse.','NON_TARGET_PHYSICAL'],
  ['finance-only beats incidental systems','Senior Finance Project Manager','Own accounting, controlling, month-end, finance processes and finance workstream. Coordinate SAP finance systems, reporting data platform and automation with IT teams.','NON_TARGET_FUNCTIONAL'],
  ['marketing project','Marketing Project Manager','Own campaigns, brand, marketing content, agencies and media planning.','NON_TARGET_FUNCTIONAL'],
  ['payroll project','Payroll Project Manager','Own payroll process, payroll operations, HR policies and employee lifecycle rollout.','NON_TARGET_FUNCTIONAL'],
  ['property project','Senior Project Manager - Group Property Transactions','Lead property transactions, real estate portfolio, facilities and lease projects.','NON_TARGET_FUNCTIONAL'],
  ['regulatory affairs only','Regulatory Affairs Specialist','Prepare regulatory submissions, product registrations, authority correspondence and compliance documentation.','NON_TARGET_FUNCTIONAL'],
  ['SAP ERP specialist','SAP S/4HANA Public Cloud Finance Project Manager','Lead SAP S/4HANA ERP finance implementation, configuration, modules, data migration and integrations.','EXCLUDED_SPECIALISM'],
  ['R&D specialist','Senior Project Manager, Global R&D, Respiratory & ENT','Lead research and development, product development, design controls, laboratory and R&D engineering activities.','EXCLUDED_SPECIALISM'],
  ['generic project manager','Senior Project Manager','Lead complex cross-functional initiatives, stakeholders, plans, risks, milestones and dependencies.','AMBIGUOUS'],
]

for(const [name,title,description,domain] of cases){
  test(`${name} -> ${domain}`,()=>{
    const result=classify(title,description)
    assert.equal(result.domain,domain)
    assert.ok(Array.isArray(result.evidence))
  })
}

test('explicit IT title wins over finance context when technology delivery is the role itself',()=>{
  const result=classify(
    'IT Project Manager - Finance Systems',
    'Lead enterprise finance applications, APIs, integrations, cloud platform migration and software releases for the finance domain.'
  )
  assert.equal(result.domain,'TARGET_TECH')
})

test('ERP and R&D specialism evidence identifies which specialism was found',()=>{
  assert.ok(classify('SAP Project Manager','SAP ERP modules and S/4HANA configuration.').evidence.includes('erp'))
  assert.ok(classify('R&D Project Manager','Research and development and product R&D.').evidence.includes('r&d'))
})
