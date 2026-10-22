import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {NIGHT_PILOT_ENABLED} from './night-pilot-feature.js'
const root=new URL('../',import.meta.url)
const read=path=>fs.readFileSync(new URL(path,root),'utf8')
test('Night Pilot is disabled centrally',()=>assert.equal(NIGHT_PILOT_ENABLED,false))
test('No Vercel cron entries exist',()=>assert.equal(JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8')).crons,undefined))
test('Layout never mounts Night Pilot drawer while disabled',()=>assert.match(read('layout.js'),/NIGHT_PILOT_ENABLED&&<NightFlightDrawer>/))
test('Main page bypasses Night Pilot fetch and bridge while disabled',()=>assert.match(read('page.js'),/NIGHT_PILOT_ENABLED\?React\.createElement\(NightFlightIntegratedHome\):React\.createElement\(MainSearchBase\)/))
test('Normal Search does not sync Night Pilot while disabled',()=>{const source=read('main-search-base.js');assert.match(source,/if\(NIGHT_PILOT_ENABLED\)\{\s*const syncResult=await attemptNightFlightProfileSync/);assert.match(source,/NIGHT_PILOT_ENABLED&&<label[^\n]*checked=\{showNightPilot\}/)})
test('Manual Night Pilot page contains no polling or action requests',()=>{const s=read('night-flight-control/page.js');assert.doesNotMatch(s,/fetch\(|setInterval|useEffect|startRun|execute\(/)})
const routes=["app/api/cron/night-flight/route.js","app/api/cron/night-flight-worker/route.js","app/api/night-flight-index/route.js","app/api/night-flight-manual/route.js","app/api/night-flight-profile/route.js","app/api/night-flight-review/route.js","app/api/night-flight-settings/route.js","app/api/night-flight-status/route.js"]
for(const path of routes){test(path+' rejects all handlers before doing work',()=>{const s=read(path);const matches=[...s.matchAll(/export async function (?:GET|POST|PUT)\([^)]*\)\s*\{\s*if\(!NIGHT_PILOT_ENABLED\) return NextResponse\.json\(\{error:'Night Pilot is disabled'\},\{status:410\}\)/g)];const total=[...s.matchAll(/export async function (?:GET|POST|PUT)\(/g)].length;assert.ok(total>0);assert.equal(matches.length,total)})}
