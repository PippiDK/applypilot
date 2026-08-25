const DEFAULT_HEADERS={
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Accept-Language':'en-US,en;q=0.9,da;q=0.8',
  'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const RETRYABLE_STATUS=new Set([408,425,429,500,502,503,504])

function retryAfterMs(response,nowMs){
  const raw=response?.headers?.get?.('retry-after')
  if(!raw) return null
  const seconds=Number(raw)
  if(Number.isFinite(seconds) && seconds>=0) return Math.round(seconds*1000)
  const when=Date.parse(raw)
  if(Number.isFinite(when)) return Math.max(0,when-nowMs)
  return null
}

function validateHtml(text,contentType=''){
  const ctype=String(contentType||'').toLowerCase()
  if(!ctype.includes('html')&&!/<html/i.test(String(text).slice(0,800))) throw new Error(`Unexpected LinkedIn content type: ${ctype||'unknown'}`)
  if(/captcha|challenge\/checkpoint|authwall/i.test(String(text))) throw new Error('LinkedIn public page returned an access wall/challenge')
  return text
}

export function createLinkedInStableFetcher({
  request=globalThis.fetch,
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  now=()=>Date.now(),
  maxConcurrency=2,
  minIntervalMs=250,
  maxAttempts=5,
  requestTimeoutMs=15000,
  baseBackoffMs=1500,
  maxBackoffMs=15000,
  totalBudgetMs=270000,
}={}){
  if(typeof request!=='function') throw new Error('A fetch implementation is required')

  const startedAt=now()
  const deadline=startedAt+Math.max(1000,Number(totalBudgetMs)||270000)
  const concurrency=Math.max(1,Math.floor(Number(maxConcurrency)||1))
  const attempts=Math.max(1,Math.floor(Number(maxAttempts)||1))
  let active=0
  const waiters=[]
  let lastStartedAt=startedAt-Math.max(0,Number(minIntervalMs)||0)
  let blockedUntil=startedAt
  let pacing=Promise.resolve()

  async function acquire(){
    if(active<concurrency){ active++; return }
    await new Promise(resolve=>waiters.push(resolve))
    active++
  }

  function release(){
    active--
    const next=waiters.shift()
    if(next) next()
  }

  async function paceStart(){
    let unlock
    const previous=pacing
    pacing=new Promise(resolve=>{ unlock=resolve })
    await previous
    try{
      const spacing=Math.max(0,Number(minIntervalMs)||0)
      const target=Math.max(blockedUntil,lastStartedAt+spacing)
      const wait=Math.max(0,target-now())
      if(wait) await sleep(wait)
      lastStartedAt=now()
    } finally {
      unlock()
    }
  }

  return async function stableFetchHtml(url){
    let lastError
    for(let attempt=1;attempt<=attempts;attempt++){
      const before=now()
      if(before>=deadline) throw new Error('LinkedIn retry budget exhausted before full source coverage was completed')

      await acquire()
      let response
      try{
        await paceStart()
        const remaining=Math.max(1,deadline-now())
        const timeout=Math.max(1000,Math.min(Number(requestTimeoutMs)||15000,remaining))
        response=await request(url,{
          headers:DEFAULT_HEADERS,
          redirect:'follow',
          cache:'no-store',
          signal:AbortSignal.timeout(timeout),
        })
      }catch(error){
        lastError=error
      }finally{
        release()
      }

      if(response){
        if(response.ok){
          const text=await response.text()
          return validateHtml(text,response.headers?.get?.('content-type')||'')
        }

        lastError=new Error(`LinkedIn HTTP ${response.status}`)
        if(!RETRYABLE_STATUS.has(Number(response.status))) throw lastError

        const retryAfter=retryAfterMs(response,now())
        const exponential=Math.min(Number(maxBackoffMs)||15000,(Number(baseBackoffMs)||1500)*(2**(attempt-1)))
        const delay=Math.max(retryAfter??0,exponential)
        blockedUntil=Math.max(blockedUntil,now()+delay)
      }else if(attempt<attempts){
        const exponential=Math.min(Number(maxBackoffMs)||15000,(Number(baseBackoffMs)||1500)*(2**(attempt-1)))
        blockedUntil=Math.max(blockedUntil,now()+exponential)
      }

      if(attempt===attempts) break
      if(blockedUntil>=deadline) throw new Error('LinkedIn retry budget exhausted before full source coverage was completed')
    }

    throw lastError||new Error('LinkedIn request failed')
  }
}
