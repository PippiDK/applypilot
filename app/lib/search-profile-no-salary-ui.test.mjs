import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile wizard has five steps and no salary screen or salary scoring label',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(page,/profileStep\/5\*100/)
  assert.match(page,/Step \{profileStep\} of 5/)
  assert.doesNotMatch(page,/Minimum acceptable monthly salary/)
  assert.doesNotMatch(page,/Salary floor/)
  assert.doesNotMatch(page,/career\/comp/)
  assert.doesNotMatch(page,/career level 15%/)
  assert.match(page,/profileStep===4.*What should ApplyPilot exclude\?/s)
  assert.match(page,/profileStep===5.*Confirm your search profile/s)
})
