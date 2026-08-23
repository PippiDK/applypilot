export function createServerCookieAdapter(cookieStore){
  return {
    getAll(){
      return cookieStore.getAll()
    },
    setAll(cookiesToSet){
      try{
        for(const {name,value,options} of cookiesToSet){
          cookieStore.set(name,value,options)
        }
      }catch{
        // Server Components can expose a read-only cookie store. Middleware
        // refreshes sessions, while Route Handlers can persist cookie updates.
      }
    }
  }
}
