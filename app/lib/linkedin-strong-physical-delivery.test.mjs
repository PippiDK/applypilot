import test from 'node:test'
import assert from 'node:assert/strict'
import { roleGate } from './linkedin-role-gate.js'

test('Arup-style built-environment data-centre PM is rejected from realistic JD wording',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      This role focuses primarily on delivery of hyperscale data center and industrial projects in Denmark and international markets.
      Manage every stage from site selection and due diligence to commissioning and handover.
      Join a Denmark Advisory team of Project and Design Managers and Engineers tackling complex challenges in the built environment.
      Support data center projects from feasibility to full design and hand-over across multiple countries.
      Coordinate civil, structural, architectural, mechanical, electrical and environmental disciplines.
      Keep scope, programme, budget and deliverables on track and work with clients, authorities, contractors and project teams.
      Technology clients are part of the stakeholder landscape, but the project object is the facility and built environment.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/physical|built|facility|industrial|delivery object/i)
})

test('ANDRITZ-style plant and equipment PM is rejected from realistic JD wording',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Lead project execution from contract handover to final acceptance for Plant & Equipment Solutions.
      Manage a portfolio from major equipment and process-line deliveries to EPS and EPC projects.
      Plan and monitor scope, schedule, budget, risks, quality and reporting.
      Coordinate interfaces across engineering, procurement, manufacturing, installation and commissioning.
      Maintain project financial data and forecasts in the ERP system and manage contracts, changes and claims.
      Experience managing technical projects in industrial equipment, plant engineering, manufacturing, energy or process industries is required.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/physical|plant|equipment|industrial|delivery object/i)
})

test('hardware and R&D project manager is not hard-rejected when the profession is genuine project delivery',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Lead complex satellite communications product development projects across hardware, embedded software and system engineering teams.
      Own scope, schedule, budget, risks, dependencies and customer milestones from concept through verification, validation and release.
      Coordinate engineering teams and suppliers, manage governance and stakeholder reporting, and drive system integration and acceptance testing.
      The role includes R&D and hardware development, but the position is explicitly a project-management role rather than an engineer role.
      Work with software teams, technology platforms and integration interfaces across the delivery lifecycle.
    `,
  })
  assert.equal(result.pass,true)
})

test('IT infrastructure PM stays eligible even when the programme includes physical data-centre locations',()=>{
  const result=roleGate({
    title:'IT Infrastructure Project Manager',
    description:`
      Lead migration of enterprise IT infrastructure from legacy data centres to cloud and modern hosting platforms.
      Deliver network infrastructure, identity services, servers and workplace platforms with Group IT teams and vendors.
      Own scope, milestones, risks, dependencies, cutover, release readiness and go-live.
      Coordinate physical data-centre access only as a dependency; the primary delivery object is the enterprise IT infrastructure and cloud services.
    `,
  })
  assert.equal(result.pass,true)
})

test('engineering people-lead titles are rejected before JD evidence can rescue them',()=>{
  for(const title of ['Team Lead (Engineering)','Engineering Team Lead','Engineering Lead']){
    const result=roleGate({
      title,
      description:`
        Lead a software engineering team delivering cloud platforms and enterprise applications.
        Own roadmap, implementation, risks, dependencies, release readiness and stakeholder governance.
        Coordinate cross-functional delivery across product, software and business teams.
      `,
    })
    assert.equal(result.pass,false,`${title} must be excluded`)
    assert.match(result.reason,/engineering|profession|people/i)
  }
})

test('Arup-style built-environment cluster is rejected even without old exact hard-gate phrases',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Manage complex data centre campus programmes from feasibility through commissioning and handover.
      Coordinate design disciplines across civil and structural consultants plus mechanical and electrical packages.
      Manage external contractors, site activities, permitting, scope, milestones, budget, risks and client reporting.
      Teams use project software and digital document-control tools, but the role is accountable for the physical facility programme.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/built|construction|facility|physical|delivery object/i)
})

test('engineering team-lead punctuation variants are also rejected before JD',()=>{
  for(const title of ['Team Lead - Engineering','Team Lead – Engineering','Team Lead: Engineering']){
    const result=roleGate({
      title,
      description:'Own enterprise software and cloud platform delivery, implementation, risks, dependencies, releases and stakeholder governance.',
    })
    assert.equal(result.pass,false,`${title} must be excluded`)
    assert.match(result.reason,/engineering|profession|people/i)
  }
})

test('strong enterprise IT delivery object overrides incidental built-environment cluster',()=>{
  const result=roleGate({
    title:'IT Infrastructure Project Manager',
    description:`
      Lead migration of enterprise IT infrastructure and cloud services across a new corporate facility programme.
      Deliver network infrastructure, identity services and workplace platforms with Group IT from implementation through cutover and go-live.
      Construction contractors, site teams, electrical works and commissioning are dependencies managed with the facilities organisation.
      Own scope, milestones, budget, risks, dependencies and executive stakeholder governance for the technology migration.
    `,
  })
  assert.equal(result.pass,true)
})

test('built-environment disciplines count as independent cluster signals',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Coordinate civil consultants, structural engineers, mechanical packages and electrical packages across the programme.
      Own scope, milestones, risks, client reporting and handover.
      Project software is used for coordination, but the managed object is the physical works.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/built|construction|facility|physical|delivery object/i)
})
