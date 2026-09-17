export const APPLIED_JOBS_PREVIEW_USER_ID='14141414-1414-4141-8141-141414141414'

export function appliedJobsStorageUserId({environment,userId}={}){
  if(environment==='preview') return APPLIED_JOBS_PREVIEW_USER_ID
  return String(userId??'').trim()
}
