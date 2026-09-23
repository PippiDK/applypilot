import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('Applied History reversal adds ONLY user-scoped DELETE permission',()=>{
  const sql=readFileSync(new URL('../../supabase/migrations/20260923_applied_jobs_revoke.sql',import.meta.url),'utf8')
  assert.match(sql,/create policy "Users can delete own applied jobs"/i)
  assert.match(sql,/on public\.applied_jobs/i)
  assert.match(sql,/for delete\s+to authenticated\s+using\s*\(auth\.uid\(\)\s*=\s*user_id\)/i)
  assert.doesNotMatch(sql,/drop table|truncate|delete\s+from|for all|to public|to anon/i)
})
