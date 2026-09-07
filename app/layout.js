import './globals.css'
import './expertise-loader.css'
import './loader.css'
import './v15-polish.css'
import './ux-polish.css'
import './company-watch.css'
import SignOutButton from './components/sign-out-button.js'
import SplashGate from './components/splash-gate.js'
import NeutralizeLegacyTestLabels from './components/neutralize-legacy-test-labels.js'
import NightFlightDrawer from './components/night-flight-drawer.js'
import NightFlightSettings from './components/night-flight-settings.js'
import NightFlightMorningReview from './components/night-flight-morning-review.js'

export const metadata={title:'ApplyPilot',description:'Job search autopilot for senior IT professionals'}

export default function RootLayout({children}){
  const environment=process.env.VERCEL_ENV||'development'
  const shortSha=String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim().slice(0,7)
  const versionLabel=environment==='production'
    ? `LIVE 18${shortSha?` · ${shortSha}`:''}`
    : `V18 · PREVIEW${shortSha?` · ${shortSha}`:''}`

  return <html lang="en"><body><SplashGate>{children}<NightFlightDrawer><NightFlightMorningReview/><NightFlightSettings/></NightFlightDrawer><NeutralizeLegacyTestLabels/><div className="versionBadge">{versionLabel}</div><SignOutButton/></SplashGate></body></html>
}
