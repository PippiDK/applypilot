import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SEARCH_SOURCES,
  normalizeSearchSources,
  readSearchSources,
  writeSearchSources,
} from './search-sources.js'

test('new users default to LinkedIn and Jobindex enabled', () => {
  assert.deepEqual(DEFAULT_SEARCH_SOURCES, ['linkedin', 'jobindex'])
  assert.deepEqual(normalizeSearchSources(undefined), ['linkedin', 'jobindex'])
})

test('normalization removes unknown and duplicate source ids', () => {
  assert.deepEqual(normalizeSearchSources(['jobindex', 'linkedin', 'jobindex', 'bogus']), ['linkedin', 'jobindex'])
})

test('persisted empty selection remains empty instead of resetting to defaults', () => {
  const memory = new Map()
  const storage = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, value),
  }
  writeSearchSources(storage, [])
  assert.deepEqual(readSearchSources(storage), [])
})
