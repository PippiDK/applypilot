import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'

const layoutPath=new URL('../layout.js',import.meta.url)
const routePath=new URL('../api/company-search/route.js',import.meta.url)
const componentPath=new URL('../components/company-discovery.js',import.meta.url)
const authPath=new URL('./auth/require-user.js',import.meta.url)

const layout=readFileSync(layoutPath,'utf8')
const route=readFileSync(routePath,'utf8')
const auth=readFileSync(authPath,'utf8')

test('TEST keeps the Vercel preview authentication bypass',()=>{
  assert.equal(auth.includes("process.env.VERCEL_ENV==='preview'"),true)
})

test('TEST adds company and consultancy discovery around the unchanged live application',()=>{
  assert.equal(existsSync(componentPath),true)
  if(!existsSync(componentPath)) return
  const component=readFileSync(componentPath,'utf8')
  assert.equal(layout.includes("import CompanyDiscovery from './components/company-discovery.js'"),true)
  assert.equal(layout.includes("environment==='preview'&&<CompanyDiscovery/>"),true)
  assert.equal(component.includes("fetch('/api/company-search'"),true)
  assert.equal(component.includes('Companies & consultancies'),true)
})

test('company discovery route is active and includes consulting while excluding recruitment agencies',()=>{
  assert.equal(route.includes('Retired in ApplyPilot v1.0'),false)
  assert.equal(route.includes("'702200'"),true)
  assert.match(route,/management consulting|virksomhedsrådgivning/i)
  assert.match(route,/recruitment|staffing/i)
})
