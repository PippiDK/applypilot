import test from 'node:test'
import assert from 'node:assert/strict'
import { searchJobindexSource } from './jobindex-source-adapter.js'

function response(body,status=200){return {ok:status>=200&&status<300,status,text:async()=>body}}

const SEARCH_PAGE_1='<a href="/vis-job/h1001">one</a><a href="/vis-job/h1002">two</a>'
const SEARCH_PAGE_2='<a href="/vis-job/h1002">two</a><a href="/vis-job/h1003">three</a>'
const EMPTY_PAGE='<html><body>No jobs</body></html>'

function detail(id,{title='Senior Project Manager',company='Acme A/S',location='Copenhagen, Denmark',date='2026-08-30'}={}){
  return `<script type="application/ld+json">${JSON.stringify({
    '@type':'JobPosting',
    title,
    hiringOrganization:{name:company},
    jobLocation:{address:{addressLocality:location}},
    datePosted:date,
    description:`Lead project delivery for ${id}`,
    url:`https://www.jobindex.dk/vis-job/${id}`,
  })}</script>`
}

test('paginates Jobindex, accumulates unique ids and preserves discovery direction',async()=>{
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('/vis-job/h1001')) return response(detail('h1001'))
    if(String(url).includes('/vis-job/h1002')) return response(detail('h1002'))
    if(String(url).includes('/vis-job/h1003')) return response(detail('h1003'))
    if(String(url).includes('page=3')) return response(EMPTY_PAGE)
    if(String(url).includes('page=2')) return response(SEARCH_PAGE_2)
    return response(SEARCH_PAGE_1)
  }
  const result=await searchJobindexSource({
    freshnessDays:7,
    unionSearchPlan:{directions:[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}]},
    exclusionRules:[],
    filters:{},
    fetcher,
    maxPages:3,
  })
  assert.equal(result.status,'success')
  assert.equal(result.jobs.length,3)
  assert.deepEqual(result.jobs[0].foundBy,[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}])
  assert.ok(seen.some(url=>url.includes('page=2')))
  assert.ok(seen.some(url=>url.includes('/vis-job/h1003')))
})

test('retains limited-data record when one detail request fails',async()=>{
  const fetcher=async url=>{
    if(String(url).includes('/vis-job/h1001')) throw new Error('detail down')
    if(String(url).includes('page=2')) return response(EMPTY_PAGE)
    return response('<a href="/vis-job/h1001">one</a>')
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Delivery Manager',tier:'primary'}]},
    fetcher,
    maxPages:2,
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].sourceJobId,'h1001')
  assert.equal(result.jobs[0].fullJd,'')
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,true)
  assert.equal(result.status,'partial')
})

test('fails safely when Search Profile has no directions',async()=>{
  const result=await searchJobindexSource({unionSearchPlan:{directions:[]},fetcher:async()=>response('')})
  assert.equal(result.status,'failed')
  assert.match(result.error,/Search Profile/i)
})
