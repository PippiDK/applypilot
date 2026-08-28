import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('UPDATED review text is editable and exported from the edited value',()=>{
  assert.match(page,/const \[editedUpdates,setEditedUpdates\]=useState\(\{\}\)/)
  assert.match(page,/UPDATED · EDITABLE/)
  assert.match(page,/className="updatedTextEditor"/)
  assert.match(page,/value=\{editedUpdateFor\(change\)\}/)
  assert.match(page,/onChange=\{event=>setEditedUpdate\(change\.blockId,event\.target\.value\)\}/)
  assert.match(page,/newText:editedUpdateFor\(change\)/)
})
