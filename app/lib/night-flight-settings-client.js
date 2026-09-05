async function readJson(response){
  try{return await response.json()}catch{return {}}
}

export async function requestNightFlightSettings(){
  const response=await fetch('/api/night-flight-settings',{
    method:'GET',
    headers:{Accept:'application/json'},
    cache:'no-store',
  })
  const data=await readJson(response)
  if(!response.ok) throw new Error(data.error||'Night Flight settings could not be loaded.')
  return data.settings
}

export async function saveNightFlightSettings(settings){
  const response=await fetch('/api/night-flight-settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({settings}),
  })
  const data=await readJson(response)
  if(!response.ok) throw new Error(data.error||'Night Flight settings could not be saved.')
  return data.settings
}
