import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInShadow} from './linkedin-shadow-discovery.js'

const card=(id,title='Role',company='Company')=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">${company}</h4><span class="job-search-card__location">Copenhagen</span><time datetime="2026-08-26"></time></li>`

const plan={directions:[
  {key:'integration project manager',role:'Integration Project Manager',tier:'primary',origin:'cv',cvSlots:[1,3]},
  {key:'programme delivery manager',role:'Programme Delivery Manager',tier:'adjacent',origin:'manual',cvSlots:[]}
]}

test('wide discovery searches the current-day and selected windows without requesting job detail',async()=>{
  const urls=[]
  const fetcher=async url=>{
    urls.push(url)
    const parsed=new URL(url)
    const role=parsed.searchParams.get('keywords')
    return role==='Integration Project Manager'?card('1111111111','Integration Programme Manager'):card('2222222222','Programme Delivery Manager')
  }
  const result=await searchLinkedInShadow({freshnessDays:7,unionSearchPlan:plan,fetcher})
  assert.equal(urls.length,12)
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('keywords')),Array.from({length:6},()=>['Integration Project Manager','Programme Delivery Manager']).flat())
  for(const url of urls){
    const parsed=new URL(url)
    assert.equal(parsed.pathname,'/jobs-guest/jobs/api/seeMoreJobPostings/search')
    assert.equal(parsed.searchParams.get('location'),'Denmark')
    assert.ok(['r86400','r604800'].includes(parsed.searchParams.get('f_TPR')))
    assert.equal(parsed.searchParams.get('sortBy'),'DD')
    assert.ok(['0','1','2'].includes(parsed.searchParams.get('start')))
    assert.equal(url.includes('/jobPosting/'),false)
  }
  assert.equal(result.stats.searchRequests,12)
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
  assert.ok(result.stats.searchRequests>=4)
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

  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('start')),['0','25','26','0','25','26'])
  assert.equal(result.candidates.some(candidate=>candidate.jobId==='4454799999'),true)
  assert.equal(result.stats.searchRequests,6)
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
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get('start')),['0','25','50','51','0','25','50','51'])
  assert.equal(result.candidates.some(candidate=>candidate.jobId==='4454999999'),true)
})

test('variable LinkedIn page sizes advance by actual parsed rows, not 25',async()=>{
  const urls=[]
  const one={directions:[{key:'it',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const pages=new Map([
    [0,Array.from({length:10},(_,i)=>card(String(4455000000+i))).join('')],
    [10,Array.from({length:15},(_,i)=>card(String(4455000010+i))).join('')],
    [25,Array.from({length:8},(_,i)=>card(String(4455000025+i))).join('')],
    [33,'']
  ])
  const result=await searchLinkedInShadow({freshnessDays:1,unionSearchPlan:one,fetcher:async url=>{
    const offset=Number(new URL(url).searchParams.get('start'))
    urls.push(offset)
    return pages.get(offset)||''
  }})
  assert.deepEqual(urls,[0,10,25,33])
  assert.equal(result.candidates.length,33)
  assert.equal(result.coverage.status,'SEARCHED')
})

test('each LinkedIn query advances its own offset',async()=>{
  const urls=[]
  const result=await searchLinkedInShadow({freshnessDays:1,unionSearchPlan:plan,fetcher:async url=>{
    const parsed=new URL(url)
    const role=parsed.searchParams.get('keywords')
    const start=Number(parsed.searchParams.get('start'))
    urls.push([role,start])
    if(start!==0) return ''
    return Array.from({length:role==='Integration Project Manager'?10:15},(_,i)=>card(String((role==='Integration Project Manager'?4461000000:4462000000)+i))).join('')
  }})
  assert.deepEqual(urls,[
    ['Integration Project Manager',0],['Programme Delivery Manager',0],
    ['Integration Project Manager',10],['Programme Delivery Manager',15]
  ])
  assert.equal(result.candidates.length,25)
})

test('HTTP 429 on the second page preserves first-page jobs and marks coverage limited',async()=>{
  const single={directions:[{key:'it',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const result=await searchLinkedInShadow({freshnessDays:1,unionSearchPlan:single,fetcher:async url=>{
    if(new URL(url).searchParams.get('start')==='10') throw new Error('HTTP 429')
    return Array.from({length:10},(_,i)=>card(String(4463000000+i))).join('')
  }})
  assert.equal(result.candidates.length,10)
  assert.equal(result.stats.searchRequests,2)
  assert.equal(result.stats.searchFailures,1)
  assert.equal(result.coverage.status,'ACCESS LIMITED')
})

test('ignored LinkedIn offsets terminate after bounded repeated pages',async()=>{
  const single={directions:[{key:'it',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const offsets=[]
  const result=await searchLinkedInShadow({freshnessDays:1,unionSearchPlan:single,fetcher:async url=>{
    offsets.push(Number(new URL(url).searchParams.get('start')))
    return card('4464000000')
  }})
  assert.deepEqual(offsets,[0,1,2])
  assert.equal(result.candidates.length,1)
  assert.equal(result.coverage.status,'ACCESS LIMITED')
})

test('wide date windows retain first-page coverage across 30 queries under 64-request budget',async()=>{
  const widePlan={directions:Array.from({length:30},(_,i)=>({
    key:`query-${i}`,role:`Role ${i}`,tier:'primary',origin:'cv',cvSlots:[1]
  }))}
  const calls=[]
  const result=await searchLinkedInShadow({freshnessDays:3,unionSearchPlan:widePlan,fetcher:async url=>{
    const u=new URL(url)
    const keywords=u.searchParams.get('keywords')
    const window=u.searchParams.get('f_TPR')
    const offset=Number(u.searchParams.get('start'))
    calls.push({keywords,window,offset})
    const id=Number(keywords.split(' ').at(-1))
    return Array.from({length:10},(_,j)=>card(String(4480000000+id*100+j))).join('')
  }})
  assert.equal(result.stats.searchRequests,64)
  assert.equal(calls.filter(x=>x.window==='r86400'&&x.offset===0).length,30)
  assert.equal(calls.filter(x=>x.window==='r259200'&&x.offset===0).length,30)
  assert.equal(calls.filter(x=>x.window==='r86400'&&x.offset>0).length,4)
  assert.equal(result.coverage.status,'ACCESS LIMITED')
})
