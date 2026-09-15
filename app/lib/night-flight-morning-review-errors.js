const clean=value=>String(value??'').trim()

export function nightFlightFailureMessages(lastError,recoveryError){
  return [...new Set([clean(lastError),clean(recoveryError)].filter(Boolean))]
}
