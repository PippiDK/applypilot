import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'

const cssPath=new URL('../ux-polish.css',import.meta.url)
const layout=readFileSync(new URL('../layout.js',import.meta.url),'utf8')
const best=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')
const chooser=readFileSync(new URL('../components/cv-adaptation-chooser.js',import.meta.url),'utf8')

test('main UX polish has a dedicated final override stylesheet',()=>{
  assert.ok(existsSync(cssPath),'ux-polish.css must exist')
  assert.match(layout,/import '\.\/ux-polish\.css'/)
})

test('CV recommendation and selection are presented as one workflow',()=>{
  assert.match(best,/CV FOR THIS JOB/)
  assert.match(best,/cvWorkflowBest/)
  assert.match(best,/data-best-cv-ready/)
  assert.match(best,/bestCvAction/)
  assert.match(chooser,/SELECT CV TO ADAPT/)
  assert.match(chooser,/cvWorkflowChooser/)
})

test('right panel follows evaluation then CV workflow then application pack',()=>{
  assert.ok(existsSync(cssPath),'ux-polish.css must exist')
  const css=readFileSync(cssPath,'utf8')
  assert.match(css,/\.panel\{[^}]*display:flex[^}]*flex-direction:column/)
  assert.match(css,/\.expertiseHero\{[^}]*order:2/)
  assert.match(css,/\.cvWorkflowBest\{[^}]*order:3/)
  assert.match(css,/\.cvWorkflowChooser\{[^}]*order:4/)
  assert.match(css,/\.panel>\.section\{[^}]*order:5/)
})

test('primary-action hierarchy and generated state are visually explicit',()=>{
  assert.ok(existsSync(cssPath),'ux-polish.css must exist')
  const css=readFileSync(cssPath,'utf8')
  assert.match(css,/bestCvAction/)
  assert.match(css,/\.reviewActions \.primary:disabled:has\(\+ \.secondary:not\(:disabled\)\)/)
  assert.match(css,/content:"✓ CV update ready"/)
  assert.match(css,/\.reviewActions \.primary:disabled \+ \.secondary:not\(:disabled\)/)
})

test('hero, application pack and job list receive compact professional polish',()=>{
  assert.ok(existsSync(cssPath),'ux-polish.css must exist')
  const css=readFileSync(cssPath,'utf8')
  assert.match(css,/\.hero\{[^}]*padding:24px 28px/)
  assert.match(css,/\.docs\{[^}]*display:grid/)
  assert.match(css,/\.jobStatusSelect\{[^}]*opacity:\.72/)
  assert.match(css,/\.job>span:last-child/)
})
