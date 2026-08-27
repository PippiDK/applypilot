import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {runProfileJdBatch} from './linkedin-profile-jd-batch.js'

function detailHtml({title,jd}){
  const description=`${jd} `.repeat(6)
  const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:'Example Co'},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

const cases=[
  {name:'English IT project role',role:'Senior IT Project Manager',title:'Senior Project Manager',jd:'Lead software platform modernization, integrations, engineering delivery and releases.',compatible:true,score:92},
  {name:'Danish IT project role without dictionary',role:'Senior IT Project Manager',title:'IT-projektleder',jd:'Du leder digitale projekter, systemimplementeringer og tværgående leverancer.',compatible:true,score:90},
  {name:'German equivalent through same semantic interface',role:'Senior IT Project Manager',title:'IT-Projektmanager',jd:'Verantwortung für Software-Einführungen, Integrationen und technische Projektsteuerung.',compatible:true,score:89},
  {name:'Concept Artist unknown to old taxonomy',role:'Concept Artist',title:'Senior Concept Artist',jd:'Create character concepts, environment designs and visual development.',compatible:true,score:96},
  {name:'Artist Relations is different work',role:'Concept Artist',title:'Artist Relations Manager',jd:'Manage artist partnerships, contracts, commercial relationships and accounts.',compatible:false,score:22},
  {name:'Road construction PM is not IT PM',role:'Senior IT Project Manager',title:'Senior Project Manager',jd:'Lead highway construction, civil contractors, site works and road infrastructure delivery.',compatible:false,score:18},
]

for(const fixture of cases){
  test(fixture.name,async()=>{
    const candidate={jobId:'1',title:fixture.title,company:'Example Co',publishedAt:'2026-08-27',foundBy:[{key:'direction',role:fixture.role,tier:'primary'}]}
    let seenItem=null
    const result=await runProfileJdBatch({
      candidates:[candidate],
      fetcher:async()=>detailHtml({title:fixture.title,jd:fixture.jd}),
      freshnessDays:7,
      now:new Date('2026-08-27T12:00:00Z'),
      safeBudgetMs:999999,
      modelCall:async args=>{
        seenItem=args.input.items[0]
        return {results:[{jobId:'1',compatible:fixture.compatible,directionKey:fixture.compatible?'direction':'',score:fixture.score,reason:fixture.compatible?'professional work matches':'professional work differs'}]}
      }
    })
    assert.equal(seenItem.title,fixture.title)
    assert.ok(seenItem.description.includes(fixture.jd))
    assert.equal(result.jobs.length,fixture.compatible?1:0)
    assert.equal(result.processed[0].audit.stage,fixture.compatible?'KEPT':'PROFILE_ROLE_REJECT')
  })
}

test('active evaluator source contains no BUG4 profession/domain hardcoding',()=>{
  const evaluator=fs.readFileSync(new URL('./linkedin-profile-evaluator.js',import.meta.url),'utf8')
  assert.doesNotMatch(evaluator,/projektledere|TARGET_TECH|NON_TARGET_PHYSICAL|classifyProfileRoleFamily|classifyDeliveryDomain/)
})
