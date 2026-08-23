import LoginForm from './login-form.js'

export const metadata={title:'Sign in · ApplyPilot'}

export default function LoginPage(){
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b0b0b',color:'#fff',padding:24}}>
    <section style={{width:'min(420px,100%)',border:'1px solid #262626',borderRadius:18,background:'#111',padding:28,boxShadow:'0 24px 80px rgba(0,0,0,.35)'}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:'#f4c542',marginBottom:12}}>ApplyPilot</div>
      <h1 style={{fontSize:28,lineHeight:1.15,margin:'0 0 10px'}}>Sign in</h1>
      <p style={{margin:'0 0 22px',fontSize:14,lineHeight:1.55,color:'#a9a9a9'}}>Invite-only access. Enter the email address that was invited to ApplyPilot.</p>
      <LoginForm/>
    </section>
  </main>
}
