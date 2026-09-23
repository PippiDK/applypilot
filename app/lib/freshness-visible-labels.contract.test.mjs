import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {FRESHNESS_OPTIONS,freshnessRequestDays,freshnessResultLabel,freshnessSelectionFromDays} from './freshness-selection.js'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../ux-polish.css',import.meta.url),'utf8')

test('main Search renders exactly four visible freshness controls with explicit text',()=>{
  assert.match(page,/const WINDOWS=\[\{days:1,label:'1 Day'\},\{days:3,label:'Previous Day'\},\{days:5,label:'5 Days'\},\{days:10,label:'10 Days'\}\]/)
  assert.match(page,/WINDOWS\.map\(\(\{days,label\}\)=>/)
  assert.match(page,/>\{label\}<\/button>/)
  assert.doesNotMatch(css,/\.controls>div:first-child .choices>\.choice\{font-size:0\}/)
  assert.doesNotMatch(css,/\.controls>div:first-child .choices>\.choice:nth-child\(/)
})

test('freshness display, request, and result header are mapped from one selected value',()=>{
  const options=[['today',1,'1 Day'],['yesterday',3,'Previous Day'],['5d',5,'Newest 5 Days'],['10d',10,'Newest 10 Days']]
  assert.deepEqual(FRESHNESS_OPTIONS.map(x=>x.id),options.map(x=>x[0]))
  for(const [id,days,heading] of options){
    assert.equal(freshnessRequestDays(id),days)
    assert.equal(freshnessSelectionFromDays(days),id)
    assert.equal(freshnessResultLabel(id),heading)
  }
  assert.match(page,/freshnessResultLabel\(freshnessSelectionFromDays\(freshnessDays\)\)/)
  assert.match(page,/const \[freshnessDays,setFreshnessDays\]=useState\(5\)/)
})
