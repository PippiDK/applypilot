import test from 'node:test'
import assert from 'node:assert/strict'
import {visibleElementKey} from './night-flight-react-key.js'

test('extracts sourceJobId from a direct React key',()=>{
  assert.equal(visibleElementKey('.$4456985138'),'4456985138')
})

test('extracts sourceJobId from a nested React Children key',()=>{
  assert.equal(visibleElementKey('.7:$4456985138'),'4456985138')
})

test('decodes React escaped key characters after extracting the leaf key',()=>{
  assert.equal(visibleElementKey('.3:$linkedin=24456985138'),'linkedin:4456985138')
})
