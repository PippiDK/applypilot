'use client'

function appliedDate(value){
  if(!value) return 'Date unavailable'
  const date=new Date(value)
  return Number.isFinite(date.getTime())?date.toLocaleDateString('en-DK'):'Date unavailable'
}

function applicationStatusLabel(value){
  if(value==='interview') return 'INTERVIEW'
  if(value==='rejected') return 'REJECTED'
  return 'APPLIED'
}

export default function AppliedJobsArchive({jobs=[],error='',open,onOpen,onClose,onStatusChange}){
  return <>
    <button className="appliedArchiveTab" onClick={onOpen} aria-label="Open applied jobs archive">
      <span>APPLIED</span><b>{jobs.length}</b>
    </button>
    {error&&<div className="errorBox appliedArchiveSaveError" role="alert"><b>Applied History save failed</b><span>{error}</span></div>}
    {open&&<div className="appliedArchiveBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
      <aside className="appliedArchiveDrawer" aria-label="Applied jobs archive">
        <div className="appliedArchiveHead">
          <div><p className="eyebrow">APPLICATION HISTORY</p><h2>Applied jobs</h2><span>{jobs.length} saved position{jobs.length===1?'':'s'}</span></div>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="appliedArchiveList">
          {jobs.length?jobs.map(item=><article className="appliedArchiveItem" key={item.jobId}>
            <div className="appliedArchiveItemTop">
              <div><b>{item.title}</b><span>{item.company}{item.location?' · '+item.location:''}</span></div>
              {item.relevanceScore!=null&&<strong>{Math.round(item.relevanceScore*10)}%</strong>}
            </div>
            <div className="appliedArchiveLifecycle">
              <select
                className={`applicationStatusBadge applicationStatusSelect applicationStatus-${item.applicationStatus||'applied'}`}
                value={item.applicationStatus||'applied'}
                onChange={event=>onStatusChange?.(item.jobId,event.target.value)}
                aria-label={`Application status for ${item.title}`}
              >
                <option value="applied">APPLIED</option>
                <option value="interview">INTERVIEW</option>
                <option value="rejected">REJECTED</option>
              </select>
              <small>Applied {appliedDate(item.appliedAt)}</small>
            </div>
            {item.originalUrl&&<a className="secondary openLink appliedArchiveLink" href={item.originalUrl} target="_blank" rel="noreferrer">Open vacancy</a>}
          </article>):<div className="empty">No saved applications yet. Mark a vacancy APPLIED, INTERVIEW or REJECTED and it will stay here.</div>}
        </div>
      </aside>
    </div>}
  </>
}
