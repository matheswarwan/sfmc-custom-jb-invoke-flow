export interface SalesforceEnvironment {
  SF_CLIENT_ID?: string;
  SF_CLIENT_SECRET?: string;
  SF_LOGIN_URL?: string;
}
interface AccessToken { value: string; instanceUrl: string; renewAt: number }
export function loginOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.my\.salesforce\.com$/.test(url.hostname)) {
    throw new Error('SF_LOGIN_URL must be an HTTPS Salesforce My Domain origin, without a path.');
  }
  return url.origin;
}
async function boundedJson(response: Response): Promise<Record<string,unknown>> {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Empty Salesforce token response.');
  const chunks: Uint8Array[]=[]; let size=0;
  while (true) { const {done,value}=await reader.read(); if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('Salesforce token response exceeds limit.');}chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Invalid Salesforce token response.'); }
}
/** Backend-only. One instance per connection; never export tokens through an HTTP route. */
export class SalesforceClient {
  private token?: AccessToken;
  private pending?: Promise<AccessToken>;
  constructor(private env: SalesforceEnvironment, private remote: typeof fetch = fetch, private now=()=>Date.now()) {}
  private async accessToken(): Promise<AccessToken> {
    if(this.token && this.token.renewAt>this.now())return this.token;
    if(this.pending)return this.pending;
    this.pending=this.exchange();
    try { return this.token=await this.pending; } finally { this.pending=undefined; }
  }
  private async exchange(): Promise<AccessToken> {
    const {SF_CLIENT_ID:id,SF_CLIENT_SECRET:secret,SF_LOGIN_URL:login}=this.env;
    if(!id || !secret || !login)throw new Error('Salesforce environment configuration is incomplete.');
    const origin=loginOrigin(login);
    const response=await this.remote(`${origin}/services/oauth2/token`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:secret})
    });
    if(!response.ok){await response.body?.cancel();throw new Error(`Salesforce client credentials exchange failed (${response.status}). Check the app policy and integration user.`);}
    const body=await boundedJson(response);
    if(typeof body.access_token!=='string'||!body.access_token||typeof body.instance_url!=='string')throw new Error('Salesforce token response is incomplete.');
    const instanceUrl=loginOrigin(body.instance_url);
    // Salesforce may omit expires_in. A short cache avoids assuming the org's session policy.
    const ttl=typeof body.expires_in==='number'&&body.expires_in>0?Math.max(0,Math.min(300,body.expires_in-30)):300;
    return {value:body.access_token,instanceUrl,renewAt:this.now()+ttl*1000};
  }
  async request(path:string,init:RequestInit={}):Promise<Response>{
    if(!/^\/services\/data\/v\d+\.\d+\//.test(path)||path.includes('://')||path.includes('\\')||path.includes('#')||path.split('?')[0].split('/').some(s=>s==='..'||s==='.')||/%(?:2e|2f|5c)/i.test(path))throw new Error('Unsupported Salesforce API path.');
    if(init.body && typeof init.body!=='string' && !(init.body instanceof URLSearchParams))throw new Error('API bodies must be replayable.');
    const send=async(token:AccessToken)=>{
      const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${token.value}`);
      return this.remote(token.instanceUrl+path,{...init,headers,redirect:'error',signal:AbortSignal.timeout(8000)});
    };
    const first=await this.accessToken();let response=await send(first);
    if(response.status===401){
      await response.body?.cancel();
      if(this.token===first)this.token=undefined;
      response=await send(await this.accessToken());
    }
    return response;
  }
}
