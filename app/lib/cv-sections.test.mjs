import test from 'node:test'
import assert from 'node:assert/strict'
import { detectCvStructure, roleLengthWindow } from './cv-sections.js'

const separateLines=`
JANE EXAMPLE
Senior IT Delivery Manager
PROFESSIONAL SUMMARY
Senior delivery leader with enterprise platform experience and cross-functional programme ownership.
PROFESSIONAL EXPERIENCE
Senior Project Manager
Example A/S
Jun 2022 – Mar 2026
Led a multi-year platform programme over 3.5 years. Managed roadmap, risks and stakeholders.
• Delivered release readiness and go-live across distributed teams.
Delivery Manager
Example Bank
Nov 2019 – May 2022
Led regulated technology delivery. Managed releases and dependencies.
• Improved data and reporting delivery across business and technology teams.
EDUCATION
Example University
`

const inlineHeader=`
ALEX SAMPLE
SUMMARY
Technology programme leader with enterprise delivery experience.
EXPERIENCE
Program Manager | Alpha Ltd | 2023–Present
Led global integration delivery across product and engineering teams.
• Managed senior stakeholders and dependencies.
Project Manager | Beta Ltd | 2020–2023
Delivered data and reporting initiatives in a regulated environment.
• Coordinated release planning and operational readiness.
SKILLS
Jira, Azure DevOps
`

const sameEmployer=`
PROFESSIONAL SUMMARY
Delivery professional.
PROFESSIONAL EXPERIENCE
Senior Delivery Manager | SameCo | 2022–Present
Led enterprise delivery.
Delivery Manager | SameCo | 2019–2022
Managed platform releases.
`

test('detects summary plus latest and previous roles from separate-line headers',()=>{
  const result=detectCvStructure(separateLines)
  assert.equal(result.professionalSummary.eligible,true)
  assert.match(result.professionalSummary.text,/Senior delivery leader/i)
  assert.doesNotMatch(result.professionalSummary.text,/PROFESSIONAL EXPERIENCE/i)
  assert.equal(result.employmentSections.length,2)
  assert.equal(result.latestRole.title,'Senior Project Manager')
  assert.equal(result.latestRole.company,'Example A/S')
  assert.equal(result.latestRole.dateText,'Jun 2022 – Mar 2026')
  assert.equal(result.previousRole.title,'Delivery Manager')
  assert.equal(result.previousRole.company,'Example Bank')
  assert.match(result.latestRole.sectionText,/3\.5 years/)
  assert.match(result.latestRole.overviewText,/Led a multi-year platform programme/i)
  assert.doesNotMatch(result.latestRole.overviewText,/Delivered release readiness/i)
})

test('detects inline role headers and open-ended latest role',()=>{
  const result=detectCvStructure(inlineHeader)
  assert.equal(result.employmentSections.length,2)
  assert.equal(result.latestRole.title,'Program Manager')
  assert.equal(result.latestRole.company,'Alpha Ltd')
  assert.match(result.latestRole.dateText,/2023.*Present/i)
  assert.equal(result.previousRole.title,'Project Manager')
  assert.equal(result.previousRole.company,'Beta Ltd')
})

test('keeps multiple roles at the same employer separate',()=>{
  const result=detectCvStructure(sameEmployer)
  assert.equal(result.employmentSections.length,2)
  assert.notEqual(result.employmentSections[0].id,result.employmentSections[1].id)
  assert.equal(result.latestRole.title,'Senior Delivery Manager')
  assert.equal(result.previousRole.title,'Delivery Manager')
})

test('missing summary does not invalidate detected employment roles',()=>{
  const result=detectCvStructure(`WORK EXPERIENCE\nLead PM | One Ltd | 2021–Present\nLed delivery.\nPM | Two Ltd | 2018–2021\nManaged projects.`)
  assert.equal(result.professionalSummary.eligible,false)
  assert.equal(result.employmentSections.length,2)
  assert.equal(result.latestRole.title,'Lead PM')
  assert.equal(result.previousRole.title,'PM')
})

test('one employment role produces latest role and no previous role',()=>{
  const result=detectCvStructure(`SUMMARY\nDelivery leader.\nEXPERIENCE\nProject Manager | One Ltd | 2022–Present\nLed delivery.`)
  assert.equal(result.employmentSections.length,1)
  assert.equal(result.latestRole.title,'Project Manager')
  assert.equal(result.previousRole,null)
})

test('role length window uses the greater of 15 percent or eight words',()=>{
  assert.deepEqual(roleLengthWindow(40),{min:32,max:48,tolerance:8})
  assert.deepEqual(roleLengthWindow(100),{min:85,max:115,tolerance:15})
})

test('parses common CV header format with title/company before location and stops overview before Key Achievements',()=>{
  const result=detectCvStructure(`
Professional Summary
Senior IT delivery leader with enterprise experience.
Core Competences
Delivery • Governance
Professional Experience
Senior Project Manager, Example Satcom | Copenhagen Jun 2022 — Mar 2026
Led the end-to-end delivery of a large-scale enterprise software platform programme with multi-million budget and global stakeholders.
Accountable for full lifecycle delivery over 3.5 years through release readiness and stable live operations.
Key Achievements
• Led a distributed team of 15+ specialists across multiple countries.
Senior IT Project/Delivery Manager, Example Bank A/S | Copenhagen Nov 2019 — May 2022
Led end-to-end delivery of complex Financial IT initiatives in a regulated environment.
Key Achievements
• Delivered automation and regulatory reporting improvements.
Education and Professional Development
Example University 2018 — 2020
`)
  assert.equal(result.employmentSections.length,2)
  assert.equal(result.latestRole.title,'Senior Project Manager')
  assert.equal(result.latestRole.company,'Example Satcom')
  assert.equal(result.previousRole.title,'Senior IT Project/Delivery Manager')
  assert.equal(result.previousRole.company,'Example Bank A/S')
  assert.match(result.latestRole.overviewText,/3\.5 years/)
  assert.doesNotMatch(result.latestRole.overviewText,/Key Achievements/i)
  assert.doesNotMatch(result.latestRole.overviewText,/15\+/)
})
