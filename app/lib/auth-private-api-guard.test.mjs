import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const routes=[
  ['company-search','../api/company-search/route.js',['NextResponse.json']],
  ['expertise-match','../api/expertise-match/route.js',['request.json','analyzeExpertiseMatch']],
  ['linkedin-search','../api/linkedin-search/route.js',['request.json','searchLinkedIn']],
  ['open-job','../api/open-job/route.js',['NextResponse.json']],
  ['parse-cv','../api/parse-cv/route.js',['request.formData']],
  ['search-jobs','../api/search-jobs/route.js',['NextResponse.json']],
  ['tailor-cv','../api/tailor-cv/route.js',['request.json','analyzeJob']]
]

for(const [name,path,businessMarkers] of routes){
  test(`${name} imports the shared route-level auth guard`,async()=>{
    const source=await readFile(new URL(path,import.meta.url),'utf8')
    assert.match(source,/requireUser/)
  })

  test(`${name} authorizes before request parsing or provider/business work`,async()=>{
    const source=await readFile(new URL(path,import.meta.url),'utf8')
    const guardIndex=source.indexOf('await requireUser()')
    assert.ok(guardIndex>=0,'missing await requireUser()')
    for(const marker of businessMarkers){
      const markerIndex=source.indexOf(marker,guardIndex+1)
      assert.ok(markerIndex>guardIndex,`${marker} must occur after auth guard`)
    }
  })
}

test('shared guard returns a uniform 401 when no authenticated user exists',async()=>{
  const source=await readFile(new URL('./auth/require-user.js',import.meta.url),'utf8')
  assert.match(source,/status\s*:\s*401/)
  assert.match(source,/Unauthorized/)
  assert.match(source,/auth\.getUser\(\)/)
})

test('shared guard exposes normalized role and an admin-only guard',async()=>{
  const source=await readFile(new URL('./auth/require-user.js',import.meta.url),'utf8')
  assert.match(source,/getUserRole/)
  assert.match(source,/role\s*:\s*getUserRole\(user\)/)
  assert.match(source,/export async function requireAdmin/)
  assert.match(source,/status\s*:\s*403/)
  assert.match(source,/Forbidden/)
})
