import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationPath=path.join(process.cwd(),'supabase/migrations/20260904_night_flight_data_model.sql')

function migrationSql(){
  assert.equal(fs.existsSync(migrationPath),true,'Night Flight migration must exist')
  return fs.readFileSync(migrationPath,'utf8')
}

test('Night Flight migration defines the four persistent tables and one run per user/day',()=>{
  const sql=migrationSql()
  for(const table of ['night_flight_settings','night_flight_profiles','night_flight_runs','night_flight_jobs']){
    assert.match(sql,new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`,'i'))
  }
  assert.match(sql,/unique\s*\(\s*user_id\s*,\s*target_date\s*\)/i)
})

test('Night Flight migration enables RLS and ownership policies for all tables',()=>{
  const sql=migrationSql()
  for(const table of ['night_flight_settings','night_flight_profiles','night_flight_runs','night_flight_jobs']){
    assert.match(sql,new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,'i'))
  }
  assert.match(sql,/night_flight_settings_select_own/i)
  assert.match(sql,/night_flight_profiles_select_own/i)
  assert.match(sql,/night_flight_runs_select_own/i)
  assert.match(sql,/night_flight_jobs_select_own/i)
  assert.match(sql,/exists\s*\(\s*select\s+1\s+from\s+public\.night_flight_runs/i)
})

test('Night Flight migration constrains sources, areas, run states and job states',()=>{
  const sql=migrationSql()
  for(const source of ['linkedin','jobindex','jobnet']) assert.match(sql,new RegExp(source,'i'))
  for(const state of ['PENDING','RUNNING','READY','READY_WITH_ERRORS','NO_JOBS','FAILED']) assert.match(sql,new RegExp(state,'i'))
  for(const state of ['QUEUED','PROCESSING','RETRY','SKIPPED_AREA']) assert.match(sql,new RegExp(state,'i'))
  assert.match(sql,/cardinality\s*\(\s*sources\s*\)\s*>?=\s*1/i)
})

test('Night Flight data model preserves resume semantics instead of duplicating a nightly batch',()=>{
  const sql=migrationSql()
  assert.match(sql,/unique\s*\(\s*user_id\s*,\s*target_date\s*\)/i,'same user/date must resolve to one run')
  assert.match(sql,/primary\s+key\s*\(\s*run_id\s*,\s*job_key\s*\)/i,'same job cannot be duplicated inside a resumed run')
  assert.match(sql,/attempts\s+integer\s+not\s+null\s+default\s+0/i,'job attempts must survive retries')
  assert.match(sql,/status\s+in\s*\([^)]*QUEUED[^)]*PROCESSING[^)]*RETRY[^)]*FAILED/i,'job lifecycle must support retry/resume states')
  assert.match(sql,/match_cache_key\s+text/i,'resumed jobs must retain their match/cache reference')
})
