import { QueryClient } from "@tanstack/react-query";

declare global { interface Window { __API_BASE__?:string } }
export function apiUrl(path:string) {
  const raw=window.__API_BASE__||"";
  if(raw.startsWith("__PORT_")){
    if(!["localhost","127.0.0.1","[::1]"].includes(location.hostname))throw new Error("Backend route was not configured.");
    return path;
  }
  return `${raw.replace(/\/$/,"")}${path}`;
}
export async function apiRequest(method:string,path:string,data?:unknown):Promise<Response>{
  const res=await fetch(apiUrl(path),{method,credentials:"same-origin",headers:data!==undefined?{"Content-Type":"application/json"}:{},body:data!==undefined?JSON.stringify(data):undefined});
  if(!res.ok){
    if(res.status===401&&!path.startsWith("/api/auth"))window.dispatchEvent(new Event("solar-session-expired"));
    const body=await res.json().catch(()=>({message:"Request failed. Please retry."}));
    throw new Error(body.message||`Request failed (${res.status})`);
  }
  return res;
}
export const queryClient=new QueryClient({defaultOptions:{
  queries:{queryFn:async({queryKey})=>(await apiRequest("GET",queryKey.join("/"))).json(),refetchOnWindowFocus:false,staleTime:30000,retry:1},
  mutations:{retry:false},
}});
