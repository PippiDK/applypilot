import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRoleTitle, roleGate } from './linkedin-role-gate.js'

const strongEnterpriseDelivery=`
Lead end-to-end enterprise IT delivery across business and technology teams.
Own scope, timeline, milestones, risks and dependencies for a cloud platform migration.
Drive systems integration, implementation, release readiness, cutover and go-live with senior stakeholders.
`

test('generic hands-on engineer titles are rejected before JD fetch',()=>{
  const titles=[
    'Staff AI Enablement Engineer',
    'AI Enablement Engineer',
    'Integration Engineer',
    'Infrastructure Engineer',
    'DevOps Engineer',
  ]
  for(const title of titles){
    assert.equal(classifyRoleTitle(title).kind,'exclude',`${title} must be excluded`)
  }
})

test('director and stream-owner career tracks are rejected before JD fetch',()=>{
  const titles=[
    'Director, Business Systems',
    'Director of IT Project Delivery',
    'Revenue Stream Owner of HXM Implementation',
  ]
  for(const title of titles){
    assert.equal(classifyRoleTitle(title).kind,'exclude',`${title} must be excluded`)
  }
})

test('people-manager hybrid title is rejected even though it contains Project Manager',()=>{
  assert.equal(
    classifyRoleTitle('Senior People & Project Manager - driving AI innovation in defence software').kind,
    'exclude',
  )
})

test('explicit ERP-specialist project-manager titles are rejected',()=>{
  const titles=[
    'HSO International - Microsoft D365 Project Manager',
    'SAP S/4HANA Public Cloud Finance Project Manager',
    'Dynamics 365 Project Manager',
  ]
  for(const title of titles){
    assert.equal(classifyRoleTitle(title).kind,'exclude',`${title} must be excluded as ERP-specialist`)
  }
})

test('generic Project Manager is rejected when technology words belong to a physical/scientific product domain rather than enterprise IT',()=>{
  const result=roleGate({
    title:'Senior Project Manager – Offshore Wind Bird Monitoring Systems',
    description:`
      Lead delivery of offshore wind bird-monitoring systems using cameras, sensors and embedded software.
      Coordinate field installation, marine surveys, hardware suppliers, environmental scientists and offshore campaigns.
      Own project schedules, milestones, risks, procurement and customer delivery of the monitoring product.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/domain|enterprise IT|technology scope/i)
})

test('industrial company Project Manager still passes when the JD clearly owns corporate enterprise IT transformation',()=>{
  const result=roleGate({
    title:'Senior Project Manager',
    description:strongEnterpriseDelivery+`
      This role sits in Group IT and delivers enterprise applications across finance and operations.
    `,
  })
  assert.equal(result.pass,true)
})

test('Business Application Manager is rejected for BAU application ownership but can pass for genuine transformation delivery',()=>{
  const bau=roleGate({
    title:'Business Application Manager',
    description:`
      Own day-to-day business application operations, vendor tickets, incident management, access administration,
      support requests, service performance and ongoing maintenance of enterprise applications.
      Coordinate stakeholders and maintain the application roadmap.
    `,
  })
  assert.equal(bau.pass,false)

  const transformation=roleGate({
    title:'Business Application Manager',
    description:strongEnterpriseDelivery+`
      Lead replacement of legacy business applications and transition the new platform into operations after go-live.
    `,
  })
  assert.equal(transformation.pass,true)
})
