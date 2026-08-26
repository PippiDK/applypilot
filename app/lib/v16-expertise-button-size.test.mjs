import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const css=fs.readFileSync(new URL('./v15-polish.css',import.meta.url),'utf8')
test('Run Expertise Match button is compact inside expertise card',()=>{
  assert.match(css,/\.expertiseHero\s+\.primary\s*\{[\s\S]*?width:\s*fit-content;/)
  assert.match(css,/\.expertiseHero\s+\.primary\s*\{[\s\S]*?min-width:\s*190px;/)
  assert.match(css,/\.expertiseHero\s+\.primary\s*\{[\s\S]*?padding:\s*12px\s+18px;/)
})
