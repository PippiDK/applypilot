import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRoleTitle, roleGate } from './linkedin-role-gate.js'

test('Danish plural projektledere is classified as a target project-management title',()=>{
  const result=classifyRoleTitle('Senior IT-projektledere med teknisk indsigt')
  assert.equal(result.kind,'target')
})

test('target Delivery Manager reaches scoring with credible delivery ownership even when JD uses weak IT vocabulary',()=>{
  const result=roleGate({
    title:'Delivery Manager',
    description:`
      Own customer deliveries from planning through implementation and handover.
      Coordinate internal teams and external stakeholders, manage milestones, risks and expectations,
      and ensure agreed solutions are delivered on time and to quality.
    `,
  })
  assert.equal(result.pass,true)
})

test('target Project Manager reaches scoring when delivery is clear even without an explicit enterprise-IT anchor',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Lead projects from initiation to implementation, coordinating stakeholders, suppliers and internal teams.
      Own project planning, milestones, risks, dependencies and handover and provide regular status reporting.
    `,
  })
  assert.equal(result.pass,true)
})

test('Service & Project Delivery Manager reaches scoring instead of being rejected only for missing IT keywords',()=>{
  const result=roleGate({
    title:'Service - & Project Delivery Manager - barselsvikariat',
    description:`
      Manage customer projects and service deliveries, coordinate implementation activities,
      own timelines, risks and stakeholder communication, and drive transition and handover.
    `,
  })
  assert.equal(result.pass,true)
})

test('recall relaxation does not rescue built-environment project management',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:`
      Deliver a building programme from site selection through construction, commissioning and handover.
      Coordinate civil, structural, mechanical and electrical disciplines, contractors and site teams.
      Own scope, milestones, budget, risks and client reporting.
    `,
  })
  assert.equal(result.pass,false)
  assert.match(result.reason,/built|construction|facility|physical|delivery object/i)
})

test('recall relaxation does not rescue engineering people-lead titles',()=>{
  const result=roleGate({
    title:'Team Lead (Engineering)',
    description:'Own software delivery, implementation, risks, releases and stakeholder governance.',
  })
  assert.equal(result.pass,false)
})

test('exact target PM title is deferred to evaluation even when role-gate keyword evidence is sparse',()=>{
  const result=roleGate({
    title:'Project Manager',
    description:'Coordinate customer initiatives, internal contributors and agreed outcomes across the organisation.',
  })
  assert.equal(result.pass,true)
})
