import Link from 'next/link'

export default function NightFlightControl(){
  return <main style={{maxWidth:720,margin:'48px auto',padding:'24px',color:'#e5e7eb',fontFamily:'system-ui,sans-serif'}}>
    <h1>Night Pilot is disabled</h1>
    <p>Automatic and manual Night Pilot processing is switched off. Previous run history remains stored.</p>
    <p><Link href="/">← Back to ApplyPilot</Link></p>
  </main>
}
