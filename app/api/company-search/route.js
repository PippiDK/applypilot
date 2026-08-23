import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
export const dynamic = 'force-dynamic'

async function authorize(){
  const auth=await requireUser()
  return auth.user?null:auth.response
}

export async function GET(){
  const denied=await authorize()
  if(denied) return denied
  return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410})
}

export async function POST(){
  const denied=await authorize()
  if(denied) return denied
  return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410})
}
