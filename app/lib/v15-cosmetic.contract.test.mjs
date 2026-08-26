import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const layout=fs.readFileSync(new URL('../layout.js',import.meta.url),'utf8')
const cssPath=new URL('../v15-polish.css',import.meta.url)
const iconPath=new URL('../icon.svg',import.meta.url)

test('layout imports V15 polish stylesheet',()=>{
  assert.match(layout,/import '\.\/v15-polish\.css'/)
})

test('idle Expertise Match says Not analysed without changing scored state',()=>{
  assert.equal(fs.existsSync(cssPath),true)
  const css=fs.readFileSync(cssPath,'utf8')
  assert.match(css,/Not analysed/)
  assert.match(css,/\.expertiseHero:has\(\.primary\)/)
})

test('footer replaces milestone developer note with product footer',()=>{
  const css=fs.readFileSync(cssPath,'utf8')
  assert.match(css,/ApplyPilot · Search less\. Apply better\./)
})

test('A plus arrow favicon exists',()=>{
  assert.equal(fs.existsSync(iconPath),true)
  const icon=fs.readFileSync(iconPath,'utf8')
  assert.match(icon,/<svg/)
  assert.match(icon,/aria-label="ApplyPilot A arrow icon"/)
})
