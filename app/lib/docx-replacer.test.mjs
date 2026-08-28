import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const moduleUrl=new URL('./docx-replacer.js',import.meta.url)
const modulePath=fileURLToPath(moduleUrl)

const p=(text,style='Normal')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`

const xml=`<w:document><w:body>${p('Professional Summary','Summary')}${p('First source paragraph.')}${p('Second source paragraph.')}${p('Professional Experience','Heading')}${p('Led original latest overview.','Role')}${p('Key Achievements','Heading')}${p('Led original previous overview.','Role')}</w:body></w:document>`

test('replaces only requested DOCX text blocks while preserving paragraph structure', async()=>{
  assert.ok(existsSync(modulePath),'docx replacer module must exist')
  const {replaceDocxBlocks}=await import(moduleUrl.href)
  const updated=replaceDocxBlocks(xml,[
    {originalText:'First source paragraph. Second source paragraph.',newText:'Updated first sentence. Updated second sentence.'},
    {originalText:'Led original latest overview.',newText:'Updated latest overview.'}
  ])
  assert.match(updated,/Professional Summary/)
  assert.match(updated,/Updated first sentence\./)
  assert.match(updated,/Updated second sentence\./)
  assert.match(updated,/Updated latest overview\./)
  assert.match(updated,/Led original previous overview\./)
  assert.doesNotMatch(updated,/First source paragraph\./)
  assert.doesNotMatch(updated,/Led original latest overview\./)
  assert.equal((updated.match(/<w:p>/g)||[]).length,(xml.match(/<w:p>/g)||[]).length)
})

test('fails safely when a requested source block is not in the DOCX', async()=>{
  assert.ok(existsSync(modulePath),'docx replacer module must exist')
  const {replaceDocxBlocks}=await import(moduleUrl.href)
  assert.throws(()=>replaceDocxBlocks(xml,[{originalText:'Missing source text',newText:'Replacement'}]),/source section/i)
})
