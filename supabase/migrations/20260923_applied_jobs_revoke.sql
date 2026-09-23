-- Applied History: allow an authenticated user to revoke only their own APPLIED entry.
-- No rows are deleted by this migration. Existing insert, select and update policies stay intact.
create policy "Users can delete own applied jobs"
on public.applied_jobs
for delete
to authenticated
using (auth.uid() = user_id);
