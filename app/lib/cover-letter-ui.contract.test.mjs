import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('application pack exposes generate and review cover letter flow',()=>{
  assert.match(page,/requestCoverLetter/)
  assert.match(page,/Generate/)
  assert.match(page,/COVER LETTER REVIEW/)
  assert.match(page,/LETTER · EDITABLE/)
  assert.match(page,/Regenerate/)
  assert.match(page,/Accept/)
  assert.match(page,/Download cover letter DOCX/)
})

test('cover letter generation uses reviewed CV decisions',()=>{
  assert.match(page,/finalCvBlocksForCoverLetter/)
  assert.match(page,/ADAPTATION_DECISION\.ACCEPTED\?editedUpdateFor\(change\):change\.original/)
  assert.match(page,/allReviewDecisionsMade/)
})
