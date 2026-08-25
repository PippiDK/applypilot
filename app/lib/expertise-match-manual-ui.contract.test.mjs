import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('Expertise Match is not auto-requested from a useEffect',()=>{
  const effects=[...source.matchAll(/useEffect\(\(\)=>\{([\s\S]*?)\n  \},\[[^\]]*\]\)/g)].map(match=>match[1])
  assert.equal(effects.some(body=>body.includes('requestExpertiseMatch(')),false)
})

test('Expertise Match has an explicit Run Expertise Match button',()=>{
  assert.match(source,/Run Expertise Match/)
  assert.match(source,/onClick=\{runExpertiseMatch\}/)
})

test('manual Expertise Match flow reads cache before calling API and writes successful result',()=>{
  assert.match(source,/readExpertiseMatchCache/)
  assert.match(source,/writeExpertiseMatchCache/)
  assert.match(source,/async function runExpertiseMatch\(\)/)
})
