import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInShadow} from './linkedin-shadow-discovery.js'

const card=(id,title='Role',company='Company')=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">${company}</h4><span class="job-search-card__location">Copenhagen</span><time datetime="2026-08-26"></time></li>`

const plan={directions:[
  {key:'integration project manager',role:'Integration Project Manager',tier:'primary',origin:'cv',cvSlots:[1,3]},
  {key:'programme delivery manager',role:'Programme Delivery Manager',tier:'adjacent',origin:'manual',cvSlots:[]}
]}

test('issues exactly one start=0 Denmark search request per approved direction and never requests job detail',async()=>{
  const urls=[]
  const fetcher=async url=>{
    urls.push(url)
    const parsed=new URL(url)
    const role=parsed.searchParams.get('keywords')
    return role==='Integration Project Manager'?card('1111111111','Integration Programme Manager'):card('2222222222','Programme Delivery Manager')
  }
  const result=await searchLinkedInShadow({freshnessDays:7,unionSearchPlan:plan,fetcher})
  assert.equal(urls.length,2)
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('keywords')),['Integration Project Manager','Programme Delivery Manager'])
  for(const url of urls){
    const parsed=new URL(url)
    assert.equal(parsed.pathname,'/jobs-guest/jobs/api/seeMoreJobPostings/search')
    assert.equal(parsed.searchParams.get('location'),'Denmark')
    assert.equal(parsed.searchParams.get('f_TPR'),'r604800')
    assert.equal(parsed.searchParams.get('sortBy'),'DD')
    assert.equal(parsed.searchParams.get('start'),'0')
    assert.equal(url.includes('/jobPosting/'),false)
  }
  assert.equal(result.stats.searchRequests,2)
})

test('deduplicates jobs and aggregates every finding direction with provenance',async()=>{
  const fetcher=async()=>card('1111111111','Integration Programme Manager','Example A')
  const result=await searchLinkedInShadow({freshnessDays:1,unionSearchPlan:plan,fetcher})
  assert.equal(result.candidates.length,1)
  assert.deepEqual(result.candidates[0].foundBy,[
    {key:'integration project manager',role:'Integration Project Manager',tier:'primary',origin:'cv',cvSlots:[1,3]},
    {key:'programme delivery manager',role:'Programme Delivery Manager',tier:'adjacent',origin:'manual',cvSlots:[]}
  ])
  assert.equal(result.stats.discovered,1)
  assert.equal(result.stats.primaryDirections,1)
  assert.equal(result.stats.adjacentDirections,1)
})

test('preserves successful directions when another direction fails',async()=>{
  let call=0
  const result=await searchLinkedInShadow({freshnessDays:3,unionSearchPlan:plan,fetcher:async()=>{
    call++
    if(call===2) throw new Error('blocked')
    return card('1111111111')
  }})
  assert.equal(result.candidates.length,1)
  assert.equal(result.stats.searchRequests,2)
  assert.equal(result.stats.searchFailures,1)
  assert.equal(result.coverage.status,'ACCESS LIMITED')
  assert.match(result.coverage.detail,/blocked/)
})

test('throws when every attempted direction request fails',async()=>{
  await assert.rejects(()=>searchLinkedInShadow({freshnessDays:7,unionSearchPlan:plan,fetcher:async()=>{throw new Error('all blocked')}}),/all blocked/)
})

test('empty plan returns a valid empty result without network calls',async()=>{
  let calls=0
  const result=await searchLinkedInShadow({freshnessDays:14,unionSearchPlan:{directions:[]},fetcher:async()=>{calls++;return ''}})
  assert.equal(calls,0)
  assert.deepEqual(result.candidates,[])
  assert.deepEqual(result.stats,{directions:0,primaryDirections:0,adjacentDirections:0,searchRequests:0,searchFailures:0,searchRows:0,discovered:0})
  assert.deepEqual(result.coverage,{status:'NO DIRECTIONS',detail:null})
})

test('continues to the next LinkedIn discovery page so wider windows do not lose fresh jobs pushed off page 1',async()=>{
  const urls=[]
  const singlePlan={directions:[{key:'project manager',role:'Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const firstPage=Array.from({length:25},(_,index)=>card(String(4454700000+index),`Project Manager ${index}`)).join('')
  const target=card('4454799999','Fresh Project Manager','Novo Nordisk')
  const result=await searchLinkedInShadow({
    freshnessDays:3,
    unionSearchPlan:singlePlan,
    fetcher:async url=>{
      urls.push(url)
      const start=new URL(url).searchParams.get('start')
      if(start==='0') return firstPage
      if(start==='25') return target
      return ''
    }
  })

  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('start')),['0','25'])
  assert.equal(result.candidates.some(candidate=>candidate.jobId==='4454799999'),true)
  assert.equal(result.stats.searchRequests,2)
  assert.equal(result.stats.discovered,26)
})


test('duplicate-only intermediate page does not stop bounded paging early',async()=>{
  const urls=[]
  const singlePlan={directions:[{key:'project manager',role:'Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const first=Array.from({length:25},(_,index)=>card(String(4454900000+index),`Project Manager ${index}`)).join('')
  const duplicatePage=first
  const later=card('4454999999','Project Manager Later','Later Co')
  const result=await searchLinkedInShadow({
    freshnessDays:14,
    unionSearchPlan:singlePlan,
    fetcher:async url=>{
      urls.push(url)
      const start=new URL(url).searchParams.get('start')
      if(start==='0') return first
      if(start==='25') return duplicatePage
      if(start==='50') return later
      return ''
    }
  })
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('start')),['0','25','50'])
  assert.equal(result.candidates.some(candidate=>candidate.jobId==='4454999999'),true)
})
