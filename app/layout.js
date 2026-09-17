import './globals.css'
import './expertise-loader.css'
import './loader.css'
import './v15-polish.css'
import './ux-polish.css'
import './company-watch.css'
import Script from 'next/script'
import SignOutButton from './components/sign-out-button.js'
import SplashGate from './components/splash-gate.js'
import NeutralizeLegacyTestLabels from './components/neutralize-legacy-test-labels.js'
import NightFlightDrawer from './components/night-flight-drawer.js'
import NightFlightSettings from './components/night-flight-settings.js'
import NightFlightMorningReview from './components/night-flight-morning-review.js'
import {createServerSupabaseClient} from './lib/supabase/server.js'
import {loadAppliedJobsFromSupabase} from './lib/applied-jobs-supabase-store.js'
import {APPLIED_JOBS_STORAGE_KEY} from './lib/applied-jobs.js'
import {APPLIED_JOBS_PREVIEW_USER_ID} from './lib/applied-jobs-preview.js'

export const metadata={title:'ApplyPilot',description:'Job search autopilot for senior IT professionals'}

async function appliedJobsForHydration(){
  try{
    const supabase=await createServerSupabaseClient()
    let userId=APPLIED_JOBS_PREVIEW_USER_ID

    if(process.env.VERCEL_ENV!=='preview'){
      const {data,error}=await supabase.auth.getUser()
      const user=data?.user??null
      if(error||!user) return []
      userId=user.id
    }

    return await loadAppliedJobsFromSupabase({supabase,userId})
  }catch{return []}
}

function appliedJobsHydrationScript(remoteJobs){
  const remoteJson=JSON.stringify(Array.isArray(remoteJobs)?remoteJobs:[]).replace(/</g,'\u003c')
  const keyJson=JSON.stringify(APPLIED_JOBS_STORAGE_KEY)
  return `(()=>{try{const key=${keyJson};const remote=${remoteJson};let local=[];try{const parsed=JSON.parse(localStorage.getItem(key)||'[]');local=Array.isArray(parsed)?parsed:[]}catch{}const merged=[];const seen=new Set();for(const item of [...local,...remote]){const jobId=String(item?.jobId||item?.sourceJobId||'').trim();if(!jobId||seen.has(jobId))continue;seen.add(jobId);merged.push(item)}if(merged.length)localStorage.setItem(key,JSON.stringify(merged))}catch{}})();`
}

export default async function RootLayout({children}){
  const environment=process.env.VERCEL_ENV||'development'
  const shortSha=String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim().slice(0,7)
  const versionLabel=environment==='production'
    ? `LIVE 18${shortSha?` · ${shortSha}`:''}`
    : `V18 · PREVIEW${shortSha?` · ${shortSha}`:''}`
  const remoteAppliedJobs=await appliedJobsForHydration()

  return <html lang="en"><body><Script id="applied-jobs-storage-hydration" strategy="beforeInteractive" dangerouslySetInnerHTML={{__html:appliedJobsHydrationScript(remoteAppliedJobs)}}/><SplashGate>{children}<NightFlightDrawer><NightFlightMorningReview/><NightFlightSettings/></NightFlightDrawer><NeutralizeLegacyTestLabels/><div className="versionBadge">{versionLabel}</div><SignOutButton/></SplashGate></body></html>
}
