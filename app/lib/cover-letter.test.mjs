import test from 'node:test'
import assert from 'node:assert/strict'
import {writeCoverLetter,COVER_LETTER_INSTRUCTIONS} from './cover-letter.js'

test('cover letter writer is grounded in source CV and approved positioning',async()=>{
  let captured=null
  const result=await writeCoverLetter({
    job:{sourceJobId:'j1',title:'Senior Project Manager',company:'Example',location:'Copenhagen',description:'A '.repeat(100)},
    sourceCv:{cvId:'cv-1',sourceVersion:'v1',fileName:'cv.docx',cvText:'Senior project manager '.repeat(20)},
    finalCvBlocks:[{blockId:'professional_summary',text:'Approved summary'}]
  },async args=>{
    captured=args
    return {letter:'Dear Hiring Team,\n\nGrounded letter body.\n\nKind regards,\nCandidate',focusPoints:['Programme delivery','Governance','Stakeholders']}
  })
  assert.match(COVER_LETTER_INSTRUCTIONS,/Every factual claim/)
  assert.match(COVER_LETTER_INSTRUCTIONS,/250-350 words/)
  assert.equal(captured.input.finalCvBlocks[0].text,'Approved summary')
  assert.match(result.letter,/Dear Hiring Team/)
  assert.equal(result.focusPoints.length,3)
})
