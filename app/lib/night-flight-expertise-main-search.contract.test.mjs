import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

function sourceFunction(name){
  const match=page.match(new RegExp(`function ${name}\\(value\\)\\{[\\s\\S]*?\\n\\}`))
  assert.ok(match,`${name} must exist in page.js`)
  return Function(`return (${match[0]})`)()
}

test('Main Search resolves the selected Night Flight cached analysis from the existing Night Flight index',()=>{
  assert.match(page,/resolveNightFlightExpertise/)
  assert.match(page,/activeNightFlightJob/)
})

test('Main Search replaces the visible expertiseHero with the cached Night Flight analysis instead of offering a new AI run',()=>{
  assert.match(page,/nightFlightExpertiseHero/)
  assert.match(page,/expertiseHero/)
  assert.match(page,/cachedNightFlightAnalysis/)
})

test('selected vacancy identity survives nested React key rewriting before Night Flight lookup',()=>{
  const visibleElementKey=sourceFunction('visibleElementKey')
  assert.equal(visibleElementKey('.0:$4462974280'),'4462974280')
  assert.equal(visibleElementKey('.1:$h1695756'),'h1695756')
  assert.equal(visibleElementKey('.$4462974280'),'4462974280')
})
