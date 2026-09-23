import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {searchLinkedInShadow} from './linkedin-shadow-discovery.js'
import {writeLinkedInMasterPool,readLinkedInMasterPoolSnapshot} from './linkedin-master-pool-cache.js'

const planFor=(roles=[])=>({directions:roles.map((role,index)=>({
  key:'role-'+index,role,tier:'primary',origin:'cv',cvSlots:[1],
}))})
const card=(id)=>`<li><div class="base-card"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">Project Manager</h3><h4 class="base-search-card__subtitle">Example Co</h4><time datetime="2026-09-18"></time></div></li>`
const ids=items=>new Set(items.map(item=>String(item.jobId)))

function memoryStorage(){
  const data=new Map()
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))}
}

test('RED freshness: retain page-0 candidates when subsequent LinkedIn page fails',async()=>{
  const freshId='4454799999'
  const firstPage=Array.from({length:25},(_,i)=>card(i===0?freshId:String(4454700000+i))).join('')
  const result=await searchLinkedInShadow({
    freshnessDays:7,
    unionSearchPlan:planFor(['Project Manager']),
    fetcher:async url=>{
      const start=Number(new URL(url).searchParams.get('start'))
      if(start===0)return firstPage
      throw new Error('LinkedIn subsequent page unavailable')
    },
  })
  assert.equal(ids(result.candidates).has(freshId),true,'A later page failure must not discard a verified page-0 candidate')
  assert.equal(result.coverage.status,'ACCESS LIMITED')
})

test('RED freshness: an exhausted LinkedIn discovery budget never reports completed coverage',async()=>{
  const roles=Array.from({length:18},(_,i)=>'Project Manager '+i)
  const result=await searchLinkedInShadow({
    freshnessDays:7,
    unionSearchPlan:planFor(roles),
    fetcher:async url=>{
      const parsed=new URL(url)
      const roleIndex=Number(parsed.searchParams.get('keywords').split(' ').at(-1))
      const start=Number(parsed.searchParams.get('start'))
      return Array.from({length:25},(_,i)=>card(String(7000000000+roleIndex*1000+start+i))).join('')
    },
  })
  assert.equal(result.stats.requestBudgetReached,true)
  assert.equal(result.coverage.status,'ACCESS LIMITED','Partial discovery must not be presented as complete')
  assert.match(result.coverage.detail||'',/budget/i)
})

test('RED freshness: Master Pool capacity retains newly discovered candidates, not just oldest 500',()=>{
  const storage=memoryStorage()
  const old=Array.from({length:500},(_,i)=>({jobId:'old-'+String(i).padStart(3,'0')}))
  const fresh=Array.from({length:6},(_,i)=>({jobId:'fresh-'+i}))
  writeLinkedInMasterPool({storage,fingerprint:'superset-fixture',candidates:[...old,...fresh]})
  const persisted=readLinkedInMasterPoolSnapshot({storage,fingerprint:'superset-fixture'})
  for(const row of fresh){
    assert.equal(persisted.candidates.some(candidate=>candidate.jobId===row.jobId),true,
      `Freshly discovered ${row.jobId} must survive the 500-record cache boundary`)
  }
})

test('RED freshness: ordinary Search exposes a true 5-day option rather than only 1/3/7/14',()=>{
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  const options=main.match(/const WINDOWS=\[([^\]]+)\]/)?.[1]?.split(',').map(Number)
  assert.ok(Array.isArray(options),'Expected existing Search freshness controls')
  assert.ok(options.includes(5),`5-day freshness option must exist; found: ${options.join(',')}`)
  assert.match(main,/Newest\s*\{freshnessDays\}/)
})
