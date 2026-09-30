'use client'

function appliedDate(value){
  if(!value) return 'Date unavailable'
  const date=new Date(value)
  return Number.isFinite(date.getTime())?date.toLocaleDateString('en-DK'):'Date unavailable'
}

function applicationStatusLabel(value){
  return value==='interview'?'INTERVIEW':'APPLIED'
}

export default function AppliedJobsArchive({jobs=[],error='',open,onOpen,onClose}){
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
              <span className={`applicationStatusBadge applicationStatus-${item.applicationStatus||'applied'}`}>{applicationStatusLabel(item.applicationStatus)}</span>
              <small>Applied {appliedDate(item.appliedAt)}</small>
            </div>
            {item.originalUrl&&<a className="secondary openLink appliedArchiveLink" href={item.originalUrl} target="_blank" rel="noreferrer">Open vacancy</a>}
          </article>):<div className="empty">No saved applications yet. Mark a vacancy APPLIED or INTERVIEW and it will stay here.</div>}
        </div>
      </aside>
    </div>}
  </>
}
