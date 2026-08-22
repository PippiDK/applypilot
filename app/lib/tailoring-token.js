import {createHmac,timingSafeEqual} from 'node:crypto'

const encode=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url')
const decode=value=>JSON.parse(Buffer.from(value,'base64url').toString('utf8'))
const sign=(body,secret)=>createHmac('sha256',String(secret)).update(body).digest('base64url')

export function deriveTailoringSecret(seed=''){
  if(!String(seed).trim()) throw new Error('Tailoring secret is unavailable.')
  return createHmac('sha256',String(seed)).update('applypilot:feature3:tailoring-token:v1').digest('hex')
}

export function signTailoringToken(payload,secret,now=Date.now(),{ttlMs=15*60*1000}={}){
  if(!secret) throw new Error('Tailoring secret is unavailable.')
  const issuedAt=Number(now)
  const envelope={...structuredClone(payload),iat:issuedAt,exp:issuedAt+ttlMs}
  const body=encode(envelope)
  return `${body}.${sign(body,secret)}`
}

export function verifyTailoringToken(token,secret,now=Date.now()){
  if(!secret) throw new Error('Tailoring secret is unavailable.')
  const [body,signature,...rest]=String(token??'').split('.')
  if(!body||!signature||rest.length) throw new Error('Invalid tailoring token.')
  const expected=Buffer.from(sign(body,secret))
  const actual=Buffer.from(signature)
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) throw new Error('Invalid tailoring token.')
  let payload
  try{ payload=decode(body) }catch{ throw new Error('Invalid tailoring token.') }
  if(!Number.isFinite(payload.exp)||Number(now)>payload.exp) throw new Error('Tailoring token expired.')
  return payload
}
