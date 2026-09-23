import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('all Search APIs accept an exact five-day request',()=>{
  const endpoints=['linkedin-profile-search','linkedin-search','jobindex-profile-search','jobnet-profile-search','company-profile-search','consultant-profile-search']
  for(const endpoint of endpoints){
    const source=readFileSync(new URL(`../api/${endpoint}/route.js`,import.meta.url),'utf8')
    assert.match(source,/\[1,3,5,7,10,14\]\.includes\(Number\(body\?\.freshnessDays\)\)/,endpoint)
  }
})

test('company and consultant endpoints apply the same five-day rolling result window',()=>{
  for(const endpoint of ['company-profile-search','consultant-profile-search']){
    const source=readFileSync(new URL(`../api/${endpoint}/route.js`,import.meta.url),'utf8')
    assert.match(source,/\[5,10\]\.includes\(freshnessDays\)\?filterItemsByFreshnessSelection\(jobs,freshnessDays===5\?'5d':'10d',new Date\(\)\):jobs/,endpoint)
    assert.match(source,/jobs:returnedJobs/,endpoint)
  }
})
