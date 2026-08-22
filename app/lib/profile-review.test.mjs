import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DEFAULT_PROFILE,
  mergeProfile,
  resumeToProfile,
  deriveReviewTerms,
  buildReviewChanges,
  applicationPackState
} from './profile-review.js'

test('mergeProfile fills missing v0.4 search-profile fields without changing saved values',()=>{
  const result=mergeProfile({roles:'Delivery Lead',salary:'80000'})
  assert.equal(result.roles,'Delivery Lead')
  assert.equal(result.salary,'80000')
  assert.deepEqual(result.geography,DEFAULT_PROFILE.geography)
  assert.ok(Array.isArray(result.factBank))
})

test('resumeToProfile mirrors parsed master CV without changing search preferences',()=>{
  const profile=mergeProfile({roles:'Delivery Lead',geography:['Denmark hybrid']})
  const cv={fileName:'master.pdf',facts:[{id:'FACT-001',text:'Led software delivery.',verified:true}],skills:['Agile'],parsedAt:'2026-08-22T00:00:00.000Z'}
  const result=resumeToProfile(profile,cv)
  assert.equal(result.roles,'Delivery Lead')
  assert.deepEqual(result.geography,['Denmark hybrid'])
  assert.equal(result.cvName,'master.pdf')
  assert.deepEqual(result.factBank,cv.facts)
  assert.deepEqual(result.skills,cv.skills)
  assert.equal(result.cvParsedAt,cv.parsedAt)
})

test('deriveReviewTerms uses live LinkedIn job text but does not mutate the search item',()=>{
  const item={job:{title:'Senior Delivery Manager',description:'Own software delivery, release, risk and stakeholder management.'},evaluation:{score:9.1}}
  const before=structuredClone(item)
  const terms=deriveReviewTerms(item)
  assert.deepEqual(item,before)
  assert.ok(terms.includes('delivery'))
  assert.ok(terms.includes('software'))
  assert.ok(terms.includes('release'))
  assert.ok(terms.includes('risk'))
})

test('buildReviewChanges only applies the approved conservative v0.4 rewrites',()=>{
  const facts=[{id:'FACT-001',text:'Worked closely with engineering teams in order to deliver releases.',verified:true}]
  const item={job:{title:'Delivery Lead',description:'Software delivery and release ownership.'}}
  const [change]=buildReviewChanges(facts,item)
  assert.equal(change.original,'Worked closely with engineering teams in order to deliver releases.')
  assert.equal(change.updated,'collaborated with engineering teams to deliver releases.')
  assert.equal(change.updated.includes('budget'),false)
  assert.equal(change.updated.includes('Azure'),false)
})

test('application pack becomes reviewable only when verified fact-bank evidence exists',()=>{
  assert.equal(applicationPackState(null).cvReady,false)
  assert.equal(applicationPackState({facts:[]}).cvReady,false)
  assert.equal(applicationPackState({facts:[{verified:false,text:'x'}]}).cvReady,false)
  assert.equal(applicationPackState({facts:[{verified:true,text:'Led delivery'}]}).cvReady,true)
})

test('live LinkedIn request remains freshness-only and cannot include profile or CV',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/body:JSON\.stringify\(\{freshnessDays\}\)/)
  assert.doesNotMatch(source,/JSON\.stringify\(\{freshnessDays\s*,\s*profile/)
  assert.doesNotMatch(source,/JSON\.stringify\(\{freshnessDays\s*,\s*cvData/)
})

test('review helpers accept current live LinkedIn result shape',()=>{
  const item={job:{sourceJobId:'123',title:'Technical Project Manager',company:'Example',location:'Denmark',description:'Platform migration, stakeholder and risk ownership.'},evaluation:{score:8.7,match:[],gaps:[]}}
  const facts=[{id:'FACT-001',text:'Worked closely with platform engineering teams in order to deliver migration releases.',verified:true}]
  const changes=buildReviewChanges(facts,item)
  assert.ok(changes.length>=1)
  assert.equal(changes[0].changed,true)
  assert.equal(item.evaluation.score,8.7)
})

test('merged UI restores Search Profile persistence without wiring it into LinkedIn search',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/localStorage\.getItem\('applypilot-profile'\)/)
  assert.match(source,/localStorage\.setItem\('applypilot-profile'/)
  assert.match(source,/BUILD YOUR SEARCH AGENT/)
  assert.match(source,/Step \{profileStep\} of 6/)
  assert.match(source,/Save profile/)
})

test('merged UI restores Application Pack, CV Update Review and Truth Guard',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/Application pack/)
  assert.match(source,/Review CV changes/)
  assert.match(source,/CV UPDATE REVIEW/)
  assert.match(source,/Truth Guard active/)
  assert.match(source,/Existing Master CV experience only · no new claim added/)
  assert.match(source,/Accept all safe changes/)
  assert.match(source,/Keep original/)
  assert.match(source,/Accept change/)
})

test('buildReviewChanges omits CV evidence when normalized original and updated text are the same',()=>{
  const facts=[{
    id:'FACT-ALIGNED',
    text:'Established the delivery foundation, including infrastructure, data platforms, team setup, and delivery',
    verified:true
  }]
  const item={job:{title:'AWS Migration Project Manager',description:'Platform migration, data delivery and infrastructure.'}}
  const changes=buildReviewChanges(facts,item)
  assert.deepEqual(changes,[])
})

test('CV review shows a neutral empty state when there are no actual wording changes',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/No Summary change proposed\./)
  assert.doesNotMatch(source,/No usable CV evidence was found for this review/)
})

test('all Master CV entry points use the full six-step Search Profile flow',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/setCvOpen/)
  assert.doesNotMatch(source,/cvOpen&&/)
  assert.match(source,/className="cvButton" onClick=\{startProfile\}/)
  assert.match(source,/Upload \/ analyse CV<\/button>/)
  assert.doesNotMatch(source,/onClick=\{\(\)=>setCvOpen\(true\)\}[^>]*>Upload \/ analyse CV/)
  assert.match(source,/Detected signals:/)
  assert.match(source,/Step \{profileStep\} of 6/)
})


test('profile strip reports whether a Master CV is loaded without changing search behavior',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/const resumeLoaded=Boolean\(cvData\?\.fileName\)/)
  assert.match(source,/resumeLoaded\?'Profile ready':'Profile empty'/)
  assert.doesNotMatch(source,/profileReady\?'✓ Search profile saved':'Profile loaded'/)
  assert.match(source,/body:JSON\.stringify\(\{freshnessDays\}\)/)
})

test('Version 2 proposes a JD-specific safe rewrite when the Master CV already supports the requirement',()=>{
  const facts=[{
    id:'FACT-V2-001',
    text:'Led full lifecycle delivery of a software platform across international engineering teams in Denmark, India and Poland, including release readiness for go-live and transition to operations.',
    verified:true
  }]
  const item={job:{
    title:'Integration Project Manager',
    description:'Own end-to-end software delivery across distributed engineering teams, with release readiness and go-live accountability.'
  }}
  const changes=buildReviewChanges(facts,item)
  assert.equal(changes.length,1)
  assert.equal(changes[0].original,facts[0].text)
  assert.match(changes[0].updated,/end-to-end lifecycle/i)
  assert.match(changes[0].updated,/distributed international engineering teams/i)
  assert.match(changes[0].updated,/release and go-live readiness/i)
  assert.doesNotMatch(changes[0].updated,/go-live readiness for go-live/i)
  assert.equal(changes[0].updated.includes('budget'),false)
  assert.equal(changes[0].updated.includes('Azure'),false)
  assert.match(changes[0].why,/End-to-end delivery|Distributed \/ international teams|Release readiness \/ go-live/i)
})

test('Version 2 Step 1 tailors only the Master CV summary and never adds unsupported JD claims',()=>{
  const cvData={
    summary:'Senior IT Project & Delivery Manager with enterprise software experience. Experienced in stakeholder governance across international teams. HBS Leadership certified.',
    facts:[
      {id:'FACT-SUM-001',text:'Led full lifecycle delivery of a software platform, managing systems integration dependencies, delivery risks and governance across international teams.',verified:true}
    ]
  }
  const item={job:{
    title:'Integration Project Manager',
    description:'Lead end-to-end delivery, systems integration, risk and dependency management and governance. Azure architecture experience is required.'
  }}

  const changes=buildReviewChanges(cvData,item)
  assert.equal(changes.length,1)
  assert.equal(changes[0].id,'SUMMARY')
  assert.equal(changes[0].type,'summary')
  assert.equal(changes[0].original,cvData.summary)
  assert.match(changes[0].updated,/end-to-end delivery/i)
  assert.match(changes[0].updated,/systems integration/i)
  assert.match(changes[0].updated,/risk and dependency management/i)
  assert.match(changes[0].updated,/delivery governance/i)
  assert.doesNotMatch(changes[0].updated,/Azure/i)
})

test('Version 2 Step 1 keeps all original summary sentences but moves the most JD-relevant sentence first',()=>{
  const cvData={
    summary:'HBS Leadership certified professional with broad enterprise experience. Senior IT Project Manager leading software platform delivery and systems integration. Background includes regulatory reporting and quality assurance.',
    facts:[
      {id:'FACT-SUM-002',text:'Led software platform delivery and systems integration across cross-functional teams.',verified:true}
    ]
  }
  const item={job:{title:'Integration Project Manager',description:'Own software platform integration and delivery.'}}

  const [change]=buildReviewChanges(cvData,item)
  const sentences=[
    'HBS Leadership certified professional with broad enterprise experience.',
    'Senior IT Project Manager leading software platform delivery and systems integration.',
    'Background includes regulatory reporting and quality assurance.'
  ]
  for(const sentence of sentences) assert.ok(change.updated.includes(sentence),`missing original sentence: ${sentence}`)
  assert.ok(change.updated.indexOf(sentences[1])<change.updated.indexOf(sentences[0]))
})

test('Version 2 Step 1 can read the Master CV summary from a complete saved preview',()=>{
  const cvData={
    preview:'Yulia Example\nSenior IT Project & Delivery Manager\nPROFESSIONAL SUMMARY\nSenior IT delivery leader with enterprise software experience. Strong stakeholder governance across international teams.\nPROFESSIONAL EXPERIENCE\nSenior Project Manager | Example A/S | 2022–2026',
    facts:[{id:'FACT-SUM-003',text:'Led end-to-end software delivery across international teams with stakeholder governance.',verified:true}]
  }
  const item={job:{title:'Senior Delivery Manager',description:'Lead end-to-end software delivery and stakeholder governance.'}}
  const [change]=buildReviewChanges(cvData,item)
  assert.equal(change.id,'SUMMARY')
  assert.equal(change.original,'Senior IT delivery leader with enterprise software experience. Strong stakeholder governance across international teams.')
  assert.doesNotMatch(change.original,/PROFESSIONAL EXPERIENCE/i)
})

test('Version 2 Step 1 UI reviews the Summary only and leaves bullet reordering for Step 2',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/buildReviewChanges\(cvData,active\)/)
  assert.doesNotMatch(source,/buildReviewChanges\(reviewFacts,active\)/)
  assert.match(source,/summary change proposed/)
  assert.match(source,/Tailored Summary/)
  assert.match(source,/Step 1 updates Summary only/)
  assert.match(source,/bullets reordered · Step 2/)
})


test('Version 2 Step 1 stops Professional Summary extraction before Core Competences',()=>{
  const cvData={
    preview:'YULIA BJØRNBERG\nSenior IT Project / Delivery Manager\nProfessional Summary\nSenior IT Project and Delivery Manager with 18+ years of experience in regulated enterprise environments.\nExperienced in PMO collaboration, governance and stakeholder management.\nCore Competences\nEnd-to-End Project Delivery • Project Governance • Risk & Dependency Management',
    facts:[{id:'FACT-SUM-004',text:'Led end-to-end delivery with project governance and risk and dependency management.',verified:true}]
  }
  const item={job:{title:'Senior Delivery Manager',description:'End-to-end delivery, governance and dependency management.'}}
  const [change]=buildReviewChanges(cvData,item)
  assert.equal(change.original,'Senior IT Project and Delivery Manager with 18+ years of experience in regulated enterprise environments. Experienced in PMO collaboration, governance and stakeholder management.')
  assert.doesNotMatch(change.original,/Core Competences|Risk & Dependency Management/)
})

test('Version 2 Step 1 refuses a truncated legacy preview instead of tailoring a partial Summary',()=>{
  const cvData={
    preview:'YULIA BJØRNBERG\nProfessional Summary\nSenior IT Project and Delivery Manager with 18+ years of experience. Experienced in governance and end-to-end delivery but this preview is cut before the next CV section',
    facts:[{id:'FACT-SUM-005',text:'Led end-to-end delivery with governance.',verified:true}]
  }
  const item={job:{title:'Delivery Manager',description:'End-to-end delivery and governance.'}}
  assert.deepEqual(buildReviewChanges(cvData,item),[])
})
