import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=url=>readFile(new URL(url,import.meta.url),'utf8')

test('Help is reachable from the authenticated app utility navigation',async()=>{
  const source=await read('../components/sign-out-button.js')
  assert.match(source,/href=["']\/help["']/)
  assert.match(source,/>HELP</)
  assert.match(source,/pathname==='\/login'/)
})

test('Help page covers the complete MVP user flow and current screenshot',async()=>{
  const source=await read('../help/page.js')
  for(const text of ['Quick start','Search Profile','CV Library','Search & Filters','Vacancy review','Expertise Match','Best CV','CV Adaptation','Truth Guard','Download','LIVE vs TEST','Troubleshooting']){
    assert.ok(source.includes(text),`missing Help section: ${text}`)
  }
  assert.match(source,/\/help\/applypilot-live-results\.jpg/)
})
