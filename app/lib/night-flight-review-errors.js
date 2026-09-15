const clean=value=>String(value??'').replace(/\s+/g,' ').trim()

export function distinctRecoveryError(lastError,recoveryError){
  const saved=clean(lastError)
  const recovery=clean(recoveryError)
  return recovery&&recovery!==saved?recovery:''
}
