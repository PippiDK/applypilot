import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DEFAULT_PROFILE,
  mergeProfile,
  resumeToProfile,
  deriveReviewTerms,
  buildReviewChanges,
  applicationPackState,
  extractSummaryFromText
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

test('live LinkedIn request uses freshness plus the active Source CV text, but not Search Profile data',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/body:JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
  assert.doesNotMatch(source,/JSON\.stringify\(\{freshnessDays\s*,\s*profile/)
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
  assert.match(source,/Step \{profileStep\} of 5/)
  assert.match(source,/Save profile/)
})

test('merged UI keeps Application Pack and exposes the M4.11 Truth-Guard review flow',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/Application pack/)
  assert.match(source,/Adapt & review CV/)
  assert.match(source,/CV UPDATE REVIEW/)
  assert.match(source,/Truth Guard complete/)
  assert.match(source,/Only Truth-Guard-safe UPDATED text is shown/)
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

test('M4.11 CV review shows a neutral empty state when Truth Guard offers no changed safe block',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/No safe changes to review\./)
  assert.match(source,/The selected Source CV remains unchanged\./)
  assert.doesNotMatch(source,/No usable CV evidence was found for this review/)
})

test('Source CV upload entry points keep the current five-step Search Profile flow',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const cvLibraryStep=fs.readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/setCvOpen/)
  assert.doesNotMatch(source,/cvOpen&&/)
  assert.match(source,/className="cvButton" onClick=\{startProfile\}/)
  assert.match(source,/Upload CV<\/button>/)
  assert.match(cvLibraryStep,/Upload your CVs/)
  assert.doesNotMatch(source,/Upload your master CV/i)
  assert.doesNotMatch(source,/onClick=\{\(\)=>setCvOpen\(true\)\}[^>]*>Upload \/ analyse CV/)
  assert.match(cvLibraryStep,/Detected signals from CV 1:/)
  assert.match(source,/Step \{profileStep\} of 5/)
})


test('profile status requires a complete ready Source CV and search uses that Source CV',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(source,/const resumeLoaded=isSourceCvReady\(cvData\)/)
  assert.match(source,/resumeLoaded\?'Profile ready':'Profile empty'/)
  assert.doesNotMatch(source,/profileReady\?'✓ Search profile saved':'Profile loaded'/)
  assert.match(source,/body:JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
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

test('Version 2 Step 1.1 creates a recruiter-length Summary with professional identity first and no generated filler',()=>{
  const cvData={
    summary:'Senior IT Delivery Manager with 18+ years of experience leading complex cross-functional initiatives across enterprise and digital environments, including 7+ years driving end-to-end delivery ownership across global organisations. Proven track record of leading large-scale technology and platform initiatives from initial scope and roadmap definition through execution, release readiness, go-live, and transition into stable operations. Experienced in leading agile and hybrid delivery across distributed product and engineering teams, coordinating work across business, technology, QA, operations, and external stakeholders to deliver high-impact digital solutions aligned with strategic and customer needs. Strong in translating complex business objectives into structured and executable delivery plans while maintaining focus on collaboration, delivery momentum, transparency, and measurable outcomes. Skilled in managing cross-functional initiatives involving product development, platform evolution, integrations, data and reporting solutions, and operational improvements within complex international environments. Comfortable navigating ambiguity, aligning stakeholders, balancing priorities, removing blockers, and maintaining delivery progress across multiple streams and dependencies. Most recently, led the end-to-end delivery of the Next Generation Service Platform (NGSP), a large-scale enterprise platform programme delivered through Agile/Hybrid execution across international teams in Denmark, India, and Poland. Responsible for integrated planning, backlog and roadmap governance, stakeholder coordination, risk management, budget oversight, and executive communication throughout the full programme lifecycle. Previously delivered complex initiatives within Financial IT covering AML, regulatory reporting, data platforms, BI solutions, automation, and platform stability improvements. Known for structured execution, strong stakeholder management, proactive problem solving, and the ability to build alignment and drive delivery in fast-moving and cross-functional environments.',
    facts:[
      {id:'FACT-SUM-001',text:'Led end-to-end delivery of the Next Generation Service Platform through integration milestones, release, go-live and stable operations.',verified:true},
      {id:'FACT-SUM-002',text:'Owned integrated planning, roadmap governance, stakeholder coordination, risk and dependency management and executive reporting.',verified:true},
      {id:'FACT-SUM-003',text:'Led Agile/Hybrid delivery across international teams in Denmark, India and Poland.',verified:true}
    ]
  }
  const item={job:{
    title:'Integration Project Manager',
    description:'Lead end-to-end delivery of systems integration, risk and dependency management, delivery governance and senior stakeholder coordination. Azure architecture experience is required.'
  }}

  const [change]=buildReviewChanges(cvData,item)
  assert.equal(change.id,'SUMMARY')
  assert.equal(change.type,'summary')
  assert.ok(change.updated.startsWith('Senior IT Delivery Manager with 18+ years of experience'),change.updated)

  const words=change.updated.trim().split(/\s+/).length
  assert.ok(words>=90&&words<=120,`expected 90-120 words, got ${words}`)

  const outputSentences=change.updated.match(/[^.!?]+[.!?]+|[^.!?]+$/g).map(x=>x.trim())
  assert.ok(outputSentences.length>=3&&outputSentences.length<=5,`expected 3-5 sentences, got ${outputSentences.length}`)
  assert.match(change.updated,/integrations|integration/i)
  assert.match(change.updated,/Next Generation Service Platform|NGSP/i)
  assert.doesNotMatch(change.updated,/Relevant experience includes/i)
  assert.doesNotMatch(change.updated,/Azure/i)
  assert.doesNotMatch(change.updated,/Comfortable navigating ambiguity/i)

  const originalSentences=cvData.summary.match(/[^.!?]+[.!?]+|[^.!?]+$/g).map(x=>x.trim())
  for(const sentence of outputSentences){
    assert.ok(originalSentences.includes(sentence),`generated sentence not present in Master Summary: ${sentence}`)
  }
})

test('Version 2 Step 1.1 de-emphasises less relevant Summary content instead of retaining every sentence',()=>{
  const cvData={
    summary:'Senior IT Project Manager with 18+ years of enterprise technology experience and 7+ years of end-to-end delivery ownership. Led enterprise platform integrations across international teams with risk and dependency management. Experienced in delivery governance, senior stakeholder coordination, release readiness and go-live. Previously worked with regulatory reporting and compliance initiatives in Financial IT. HBS Leadership certified with broad organisational leadership training. Earlier career included extensive quality assurance and test management responsibilities across financial systems.',
    facts:[
      {id:'FACT-SUM-004',text:'Led enterprise platform integrations across international teams with risk and dependency management.',verified:true},
      {id:'FACT-SUM-005',text:'Managed delivery governance, senior stakeholder coordination, release readiness and go-live.',verified:true}
    ]
  }
  const item={job:{title:'Integration Project Manager',description:'Own platform integration, dependencies, governance, release and stakeholder delivery.'}}

  const [change]=buildReviewChanges(cvData,item)
  assert.ok(change.updated.startsWith('Senior IT Project Manager with 18+ years'))
  assert.match(change.updated,/platform integrations/i)
  assert.match(change.updated,/delivery governance/i)
  assert.doesNotMatch(change.updated,/HBS Leadership certified/i)
  assert.doesNotMatch(change.updated,/Earlier career included extensive quality assurance/i)
})

test('Version 2 Step 1 can read the Master CV summary from a complete saved preview',()=>{
  const preview='Yulia Example\nSenior IT Project & Delivery Manager\nPROFESSIONAL SUMMARY\nSenior IT delivery leader with enterprise software experience. Strong stakeholder governance across international teams.\nPROFESSIONAL EXPERIENCE\nSenior Project Manager | Example A/S | 2022–2026'
  const summary=extractSummaryFromText(preview)
  assert.equal(summary,'Senior IT delivery leader with enterprise software experience. Strong stakeholder governance across international teams.')
  assert.doesNotMatch(summary,/PROFESSIONAL EXPERIENCE/i)
})

test('M4.11 UI supersedes the legacy Summary-only review with three Truth-Guard-safe blocks',()=>{
  const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/buildReviewChanges\(cvData,active\)/)
  assert.match(source,/safeAdaptationReviewBlocks/)
  assert.match(source,/Professional Summary/)
  assert.match(source,/Latest role overview/)
  assert.match(source,/Previous role overview/)
  assert.doesNotMatch(source,/bullet workflow/i)
})


test('Version 2 Step 1 stops Professional Summary extraction before Core Competences',()=>{
  const preview='YULIA BJØRNBERG\nSenior IT Project / Delivery Manager\nProfessional Summary\nSenior IT Project and Delivery Manager with 18+ years of experience in regulated enterprise environments.\nExperienced in PMO collaboration, governance and stakeholder management.\nCore Competences\nEnd-to-End Project Delivery • Project Governance • Risk & Dependency Management'
  const summary=extractSummaryFromText(preview)
  assert.equal(summary,'Senior IT Project and Delivery Manager with 18+ years of experience in regulated enterprise environments. Experienced in PMO collaboration, governance and stakeholder management.')
  assert.doesNotMatch(summary,/Core Competences|Risk & Dependency Management/)
})

test('Version 2 Step 1 refuses a truncated legacy preview instead of tailoring a partial Summary',()=>{
  const cvData={
    preview:'YULIA BJØRNBERG\nProfessional Summary\nSenior IT Project and Delivery Manager with 18+ years of experience. Experienced in governance and end-to-end delivery but this preview is cut before the next CV section',
    facts:[{id:'FACT-SUM-005',text:'Led end-to-end delivery with governance.',verified:true}]
  }
  const item={job:{title:'Delivery Manager',description:'End-to-end delivery and governance.'}}
  assert.deepEqual(buildReviewChanges(cvData,item),[])
})
