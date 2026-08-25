import test from 'node:test'
import assert from 'node:assert/strict'
import { roleGate } from './linkedin-role-gate.js'

const dhiMuseJd=`
At DHI, we combine science, technology and engineering. Through DHI MUSE, we develop and deliver advanced wildlife monitoring systems for offshore wind farms.
As Senior Project Manager, you will lead multidisciplinary teams and manage complex technical deliveries involving offshore wind developers, engineering teams, hardware suppliers, software development teams, installation contractors, commissioning personnel and ecological specialists.
Lead delivery from contract award through commissioning and handover. Take overall responsibility for project scope, schedule, budget, quality and risk management. Ensure project governance and stakeholder communication.
Coordinate technical, commercial and delivery activities. Oversee supplier coordination, procurement activities and critical project interfaces. Ensure successful integration, testing, commissioning and customer acceptance of delivered systems.
Oversee system integration, acceptance testing FAT/SAT, installation and commissioning activities and operational handover.
Experience from offshore wind, offshore energy, marine systems, oil & gas, defense, industrial automation or similar industries. Experience managing hardware and software integrated systems. Technical understanding of sensors, monitoring systems, networking infrastructure or industrial automation technologies.
`

test('realistic DHI MUSE JD is rejected because the primary delivery object is a physical offshore monitoring system',()=>{
  const result=roleGate({
    title:'Senior Project Manager – Offshore Wind Bird Monitoring Systems (DHI MUSE)',
    description:dhiMuseJd,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/primary delivery object/i)
})

test('data-centre built-environment PM is rejected explicitly as physical delivery, not mistaken for IT infrastructure',()=>{
  const result=roleGate({
    title:'Project Manager - Data Center',
    description:`
      Deliver hyperscale data center and industrial projects from site selection and due diligence through commissioning and handover.
      Work in a built environment team and coordinate civil, structural, architectural, mechanical, electrical and environmental disciplines.
      Manage design, building permitting, contractors, procurement, construction programme, budget, health and safety and handover of the completed facility.
      Work with international technology clients and specialist vendors throughout the project lifecycle.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/primary delivery object/i)
})

test('IT infrastructure PM remains eligible when enterprise technology infrastructure is the primary delivery object',()=>{
  const result=roleGate({
    title:'IT Infrastructure Project Manager',
    description:`
      Lead end-to-end delivery of enterprise IT infrastructure and cloud services across network, identity and workplace platforms.
      Own scope, timeline, milestones, risks and dependencies for infrastructure migration projects.
      Coordinate Group IT teams and technology vendors, implement the target platform, drive cutover, release readiness and go-live,
      then transition the new IT services into operations.
    `,
  })
  assert.equal(result.pass,true)
})

test('enterprise software platform implementation PM remains eligible',()=>{
  const result=roleGate({
    title:'Technical Project Manager',
    description:`
      Deliver an enterprise software platform implementation across finance and operations.
      Own scope, roadmap, budget, risks, systems integration and data migration.
      Coordinate product, engineering and business teams through testing, release, cutover and go-live.
    `,
  })
  assert.equal(result.pass,true)
})
