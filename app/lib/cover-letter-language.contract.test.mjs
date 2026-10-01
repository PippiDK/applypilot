import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const client=readFileSync(new URL('./cover-letter-client.js',import.meta.url),'utf8')
const route=readFileSync(new URL('../api/cover-letter/route.js',import.meta.url),'utf8')
const writer=readFileSync(new URL('./cover-letter.js',import.meta.url),'utf8')

test('cover letter offers only same-as-job and English language choices',()=>{
  assert.match(page,/Same as job description/)
  assert.match(page,/<option value="english">English<\/option>/)
  assert.doesNotMatch(page,/<option value="danish">/)
})

test('language preference flows from UI through API to writer',()=>{
  assert.match(page,/languageMode:coverLetterLanguage/)
  assert.match(client,/languageMode:languageMode==='english'\?'english':'same_as_job'/)
  assert.match(route,/languageMode=text\(body\?\.languageMode\)==='english'\?'english':'same_as_job'/)
  assert.match(writer,/If languageMode is "english", write the entire letter and focus points in English/)
  assert.match(writer,/mixed-language or unclear, use English/)
})

test('drafts are separated by selected language',()=>{
  assert.match(page,/coverLetterKey=activeBaselineKey\?activeBaselineKey\+'\|'\+coverLetterLanguage:''/)
})
