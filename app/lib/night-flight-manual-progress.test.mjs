import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('manual Night Pilot page is inert while feature is disabled',async()=>{
  const page=await readFile(new URL('../night-flight-control/page.js',import.meta.url),'utf8')
  assert.match(page,/Night Pilot is disabled/)
  assert.doesNotMatch(page,/setInterval|useEffect|fetch\(|execute\(|resume\(|retry\(/)
})
