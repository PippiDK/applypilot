import test from 'node:test'
import assert from 'node:assert/strict'

let sourceCv = {}
try {
  sourceCv = await import('./source-cv.js')
} catch {}

const COMPLETE_TEXT = `Professional Summary\n${'Senior delivery manager with verified enterprise technology experience. '.repeat(4)}\nProfessional Experience`

function requireFunction(name){
  assert.equal(typeof sourceCv[name], 'function', `${name} must be exported`)
  return sourceCv[name]
}

test('Source CV record retains complete extracted text and source identity metadata', () => {
  const buildSourceCvRecord = requireFunction('buildSourceCvRecord')
  const record = buildSourceCvRecord({
    fileName:'candidate.pdf',
    fileSize:123456,
    fileType:'application/pdf',
    sourceVersion:'sha256:abc123',
    cvText:COMPLETE_TEXT,
    summary:'Senior delivery manager.',
    facts:[{id:'FACT-001',text:'Led enterprise delivery.',verified:true}],
    skills:['Agile'],
    preview:'short preview'
  }, '2026-08-22T16:00:00.000Z')

  assert.equal(record.status,'ready')
  assert.equal(record.schemaVersion,1)
  assert.equal(record.fileName,'candidate.pdf')
  assert.equal(record.fileSize,123456)
  assert.equal(record.fileType,'application/pdf')
  assert.equal(record.sourceVersion,'sha256:abc123')
  assert.equal(record.cvText,COMPLETE_TEXT.trim())
  assert.equal(record.chars,COMPLETE_TEXT.trim().length)
  assert.equal(record.parsedAt,'2026-08-22T16:00:00.000Z')
  assert.deepEqual(record.facts,[{id:'FACT-001',text:'Led enterprise delivery.',verified:true}])
  assert.deepEqual(record.skills,['Agile'])
})

test('Source CV readiness requires complete text and stable source identity', () => {
  const isSourceCvReady = requireFunction('isSourceCvReady')
  assert.equal(isSourceCvReady({status:'ready',fileName:'candidate.pdf',sourceVersion:'sha256:1',cvText:COMPLETE_TEXT}),true)
  assert.equal(isSourceCvReady({status:'ready',fileName:'candidate.pdf',sourceVersion:'sha256:1',cvText:'too short'}),false)
  assert.equal(isSourceCvReady({status:'ready',fileName:'candidate.pdf',cvText:COMPLETE_TEXT}),false)
  assert.equal(isSourceCvReady(null),false)
})

test('legacy stored CV without complete text is preserved only as needs-reupload, never ready', () => {
  const normalizeStoredSourceCv = requireFunction('normalizeStoredSourceCv')
  const isSourceCvReady = requireFunction('isSourceCvReady')
  const legacy = normalizeStoredSourceCv({
    fileName:'old-master.pdf',
    chars:5000,
    summary:'Old summary',
    facts:[{id:'FACT-001',text:'Verified fact.',verified:true}],
    skills:['Agile'],
    preview:'partial preview',
    parsedAt:'2026-08-21T10:00:00.000Z'
  })

  assert.equal(legacy.fileName,'old-master.pdf')
  assert.equal(legacy.status,'needs-reupload')
  assert.equal(isSourceCvReady(legacy),false)
})

test('stored complete Source CV normalizes to ready and keeps full cvText', () => {
  const normalizeStoredSourceCv = requireFunction('normalizeStoredSourceCv')
  const isSourceCvReady = requireFunction('isSourceCvReady')
  const stored = normalizeStoredSourceCv({
    fileName:'candidate.docx',
    fileSize:9000,
    fileType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceVersion:'sha256:xyz',
    cvText:COMPLETE_TEXT,
    summary:'Summary',
    facts:[],
    skills:[],
    preview:'preview',
    parsedAt:'2026-08-22T10:00:00.000Z'
  })

  assert.equal(stored.status,'ready')
  assert.equal(stored.schemaVersion,1)
  assert.equal(stored.cvText,COMPLETE_TEXT.trim())
  assert.equal(isSourceCvReady(stored),true)
})
