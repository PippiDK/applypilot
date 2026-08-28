import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const css=readFileSync(new URL('../ux-polish.css',import.meta.url),'utf8')

test('Expertise Match, Find best CV and Generate CV update share the exact primary action style',()=>{
  assert.match(css,/\.expertiseHero \.primary,\.panel \.bestCvAction,\.cvWorkflowChooser \.reviewActions \.primary\{[^}]*background:#e9fff6[^}]*color:#07110d[^}]*border:0[^}]*border-radius:10px[^}]*padding:8px 11px[^}]*font-size:12px[^}]*font-weight:850[^}]*line-height:normal[^}]*width:max-content[^}]*min-width:0[^}]*height:auto[^}]*min-height:0[^}]*flex:0 0 auto/)
  assert.doesNotMatch(css,/min-width:210px|padding:15px 28px/)
  assert.doesNotMatch(css,/\.reviewActions \.primary:not\(:disabled\)\{background:#15191f/)
})
