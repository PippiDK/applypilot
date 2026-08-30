import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJobindexSearchRecords, extractJobindexDetail, jobindexDetailUrl } from './jobindex-parser.js'

test('extracts stable Jobindex ids once and ignores unrelated hrefs', () => {
  const html=`<a href="/vis-job/h1693319">Role</a><a href="/company/acme">Acme</a><a href="https://www.jobindex.dk/vis-job/h1693319">Role duplicate</a><a href="/vis-job/not-a-job">No</a>`
  const records=extractJobindexSearchRecords(html)
  assert.deepEqual(records.map(record=>record.jobId),['h1693319'])
  assert.equal(records[0].detailUrl,'https://www.jobindex.dk/vis-job/h1693319')
})

test('builds canonical detail URL', () => {
  assert.equal(jobindexDetailUrl('h1693319'),'https://www.jobindex.dk/vis-job/h1693319')
})

test('detail parser reads JobPosting JSON-LD', () => {
  const html=`<html><script type="application/ld+json">${JSON.stringify({
    '@context':'https://schema.org','@type':'JobPosting',title:'Senior Project Manager',
    hiringOrganization:{name:'Acme A/S'},jobLocation:{address:{addressLocality:'Copenhagen',addressCountry:'DK'}},
    datePosted:'2026-08-30',description:'<p>Lead complex delivery.</p>',url:'https://www.jobindex.dk/vis-job/h1693319',
    directApply:true
  })}</script><a rel="nofollow" href="https://acme.example/jobs/42">Søg jobbet</a></html>`
  const detail=extractJobindexDetail(html,{jobId:'h1693319'})
  assert.equal(detail.title,'Senior Project Manager')
  assert.equal(detail.company,'Acme A/S')
  assert.match(detail.location,/Copenhagen/)
  assert.equal(detail.country,'DK')
  assert.equal(detail.postedDate,'2026-08-30')
  assert.match(detail.fullJd,/Lead complex delivery/)
  assert.equal(detail.applicationUrl,'https://acme.example/jobs/42')
})

test('detail parser captures explicit remote and hybrid work-model signals', () => {
  const remoteHtml=`<script type="application/ld+json">${JSON.stringify({
    '@type':'JobPosting',title:'Delivery Manager',jobLocationType:'TELECOMMUTE',description:'Remote role available from Denmark.'
  })}</script>`
  const hybridHtml=`<script type="application/ld+json">${JSON.stringify({
    '@type':'JobPosting',title:'Delivery Manager',description:'We use a hybrid working model with office days in Copenhagen.'
  })}</script>`
  assert.equal(extractJobindexDetail(remoteHtml,{jobId:'h2'}).remoteType,'remote')
  assert.equal(extractJobindexDetail(hybridHtml,{jobId:'h3'}).remoteType,'hybrid')
})

test('missing optional fields do not throw', () => {
  const detail=extractJobindexDetail('<html></html>',{jobId:'h1'})
  assert.equal(detail.title,'')
  assert.equal(detail.fullJd,'')
})