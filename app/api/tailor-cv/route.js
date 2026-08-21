import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET(){ return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410}) }
export async function POST(){ return NextResponse.json({error:'Retired in ApplyPilot v1.0. LinkedIn-only milestone is active.'},{status:410}) }
