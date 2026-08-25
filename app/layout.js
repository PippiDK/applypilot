import './globals.css'
import './expertise-loader.css'
import './loader.css'
import './v15-polish.css'
import SignOutButton from './components/sign-out-button.js'

export const metadata={title:'ApplyPilot',description:'Job search autopilot for senior IT professionals'}

export default function RootLayout({children}){
  return <html lang="en"><body>{children}<SignOutButton/></body></html>
}
