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
  assert.match(source,/No CV changes proposed\./)
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
