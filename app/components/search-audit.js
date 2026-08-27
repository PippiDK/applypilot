'use client'

function scoreText(value){
  if(value==null||value==='') return '—'
  const numeric=Number(value)
  if(!Number.isFinite(numeric)) return '—'
  const percent=numeric>=0&&numeric<=10?numeric*10:numeric
  const rounded=Math.round(percent*10)/10
  return `${rounded}%`
}

export default function SearchAudit({audit=[]}){
  if(!Array.isArray(audit)||audit.length===0) return null
  return <details className="searchAudit">
    <summary style={{cursor:'pointer',fontWeight:700,margin:'10px 0'}}>Search audit · {audit.length} discovered jobs</summary>
    <div style={{overflowX:'auto',margin:'0 0 18px',border:'1px solid rgba(127,127,127,.25)',borderRadius:10,padding:'8px'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,textAlign:'left'}}>
        <thead><tr><th style={{padding:'7px'}}>Job</th><th style={{padding:'7px'}}>Company</th><th style={{padding:'7px'}}>Stage</th><th style={{padding:'7px'}}>Decision</th><th style={{padding:'7px'}}>Score</th><th style={{padding:'7px'}}>Reason</th></tr></thead>
        <tbody>{audit.map(row=><tr key={row.jobId} style={{borderTop:'1px solid rgba(127,127,127,.18)'}}>
          <td style={{padding:'7px',minWidth:220}}>{row.title||'—'}</td>
          <td style={{padding:'7px',minWidth:130}}>{row.company||'—'}</td>
          <td style={{padding:'7px',whiteSpace:'nowrap'}}>{row.stage||'—'}</td>
          <td style={{padding:'7px',whiteSpace:'nowrap'}}>{row.decision||'—'}</td>
          <td style={{padding:'7px',whiteSpace:'nowrap'}}>{scoreText(row.score)}</td>
          <td style={{padding:'7px',minWidth:260}}>{row.reason||'—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>
}
