export function createNoStoreFetch(baseFetch=globalThis.fetch){
  if(typeof baseFetch!=='function') throw new Error('Supabase backend fetch is unavailable')
  return (input,init={})=>baseFetch(input,{...init,cache:'no-store'})
}
