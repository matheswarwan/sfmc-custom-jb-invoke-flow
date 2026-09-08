const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
}
export const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function hash(value: string) { return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))); }
export async function equalSecret(a: string, b: string): Promise<boolean> {
  const key=await crypto.subtle.importKey('raw',encoder.encode(b),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(a));
  return crypto.subtle.verify('HMAC',key,signature,encoder.encode(b));
}
export async function encrypt(value: unknown, secret: string): Promise<string> {
  const key=await crypto.subtle.importKey('raw',decode(secret),'AES-GCM',false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('jah:sf-prod:v1')},key,encoder.encode(JSON.stringify(value)));
  return `${base64url(iv)}.${base64url(new Uint8Array(data))}`;
}
export async function decrypt<T>(value: string, secret: string): Promise<T> {
  const [iv,data]=value.split('.');
  const key=await crypto.subtle.importKey('raw',decode(secret),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode('jah:sf-prod:v1')},key,decode(data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
export function salesforceOrigin(value: string): string {
  const url=new URL(value);
  const host=url.hostname;
  if(url.protocol!=='https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname!=='/' ||
    !(host==='login.salesforce.com' || host==='test.salesforce.com' || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.my\.salesforce\.com$/.test(host))) throw new Error('Use a Salesforce HTTPS login, sandbox or My Domain URL without a path.');
  return url.origin;
}
export function cookie(request: Request, name: string): string {
  return (request.headers.get('cookie') ?? '').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1) ?? '';
}
export const sessionCookie=(value: string, age=1800)=>`__Host-jah-admin=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...headers}});
export async function limitedText(response: Response | Request, max=65536): Promise<string> {
  const reader=response.body?.getReader(); if(!reader) return '';
  const chunks:Uint8Array[]=[]; let total=0;
  while(true) { const {done,value}=await reader.read(); if(done) break; total+=value.length; if(total>max) { await reader.cancel(); throw new Error('Response exceeds limit'); } chunks.push(value); }
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
