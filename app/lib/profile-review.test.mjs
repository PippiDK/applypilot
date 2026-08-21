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
  const facts=[{id:'FACT-001',text:'Led platform migration and stakeholder delivery.',verified:true}]
  const changes=buildReviewChanges(facts,item)
  assert.ok(changes.length>=1)
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
