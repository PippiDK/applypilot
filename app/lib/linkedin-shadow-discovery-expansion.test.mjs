import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInShadow} from './linkedin-shadow-discovery.js'
const card=(id,title='Role')=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">Company</h4></li>`

test('expanded direction searches by query while preserving original source role and provenance',async()=>{
  const urls=[]
  const plan={directions:[{key:'integration project manager|expanded|implementation manager',role:'Integration Project Manager',query:'Implementation Manager',discoveryMode:'expanded',tier:'primary',origin:'cv',cvSlots:[1]}]}
  const result=await searchLinkedInShadow({freshnessDays:14,unionSearchPlan:plan,fetcher:async url=>{urls.push(url);return card('4456985138','Payroll Implementation Manager')}})
  assert.equal(new URL(urls[0]).searchParams.get('keywords'),'Implementation Manager')
  assert.deepEqual(result.candidates[0].foundBy[0],{key:'integration project manager|expanded|implementation manager',role:'Integration Project Manager',query:'Implementation Manager',discoveryMode:'expanded',tier:'primary',origin:'cv',cvSlots:[1]})
})

test('deduplicates one LinkedIn query shared by exact and expanded directions while preserving both source provenances',async()=>{
  let calls=0
  const plan={directions:[
    {key:'project manager',role:'Project Manager',query:'Project Manager',discoveryMode:'exact',tier:'primary',origin:'cv',cvSlots:[1]},
    {key:'senior project manager|expanded|project manager',role:'Senior Project Manager',query:'Project Manager',discoveryMode:'expanded',tier:'primary',origin:'cv',cvSlots:[2]}
  ]}
  const result=await searchLinkedInShadow({freshnessDays:7,unionSearchPlan:plan,fetcher:async()=>{calls++;return card('4456000000','Project Manager')}})
  assert.equal(calls,1)
  assert.equal(result.candidates.length,1)
  assert.deepEqual(result.candidates[0].foundBy.map(x=>[x.role,x.discoveryMode]),[['Project Manager','exact'],['Senior Project Manager','expanded']])
})
