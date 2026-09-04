import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'

const pagePath=new URL('../page.js',import.meta.url)
const layoutPath=new URL('../layout.js',import.meta.url)
const companyRoutePath=new URL('../api/company-profile-search/route.js',import.meta.url)
const consultantRoutePath=new URL('../api/consultant-profile-search/route.js',import.meta.url)
const companyConfigPath=new URL('./company-watch.js',import.meta.url)
const consultantConfigPath=new URL('./consultant-portals.js',import.meta.url)

const page=readFileSync(pagePath,'utf8')
const layout=readFileSync(layoutPath,'utf8')

test('TEST restores the inline company watch and consultant portal controls from 3716233',()=>{
  assert.match(page,/DIRECT COMPANY WATCH/)
  assert.match(page,/Company career sites/)
  assert.match(page,/CONSULTANT PORTALS/)
  assert.match(page,/Freelance & consulting assignments/)
})

test('company and consultant sources participate in the main Search workflow',()=>{
  assert.match(page,/\/api\/company-profile-search/)
  assert.match(page,/\/api\/consultant-profile-search/)
  assert.match(page,/company-sites/)
  assert.match(page,/consultant-portals/)
  assert.equal(existsSync(companyRoutePath),true)
  assert.equal(existsSync(consultantRoutePath),true)
  assert.equal(existsSync(companyConfigPath),true)
  assert.equal(existsSync(consultantConfigPath),true)
})

test('the mistaken floating company discovery drawer is absent',()=>{
  assert.equal(layout.includes('CompanyDiscovery'),false)
  assert.equal(layout.includes('company-discovery'),false)
})
