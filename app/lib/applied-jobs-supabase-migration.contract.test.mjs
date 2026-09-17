import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migrationPath=new URL('../../supabase/migrations/20260917_applied_jobs.sql',import.meta.url)

test('applied history is a permanent per-user Supabase table with RLS',()=>{
  const sql=readFileSync(migrationPath,'utf8')
  assert.match(sql,/create table if not exists public\.applied_jobs/i)
  assert.match(sql,/primary key\s*\(user_id,\s*job_id\)/i)
  assert.match(sql,/alter table public\.applied_jobs enable row level security/i)
  assert.match(sql,/auth\.uid\(\)\s*=\s*user_id/i)
  assert.doesNotMatch(sql,/delete where|interval\s+'10 days'|expires_at|ttl/i)
})
