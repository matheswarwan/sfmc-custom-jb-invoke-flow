import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConnectionService,type Store} from '../deployment/cloudflare/oauth/service.ts';
import {decrypt,encrypt,hash,random,salesforceOrigin} from '../deployment/cloudflare/oauth/security.ts';
import {normalizeTokens} from '../deployment/cloudflare/oauth/salesforce.ts';
const origin='https://hub.example';
const identity='https://login.salesforce.com/id/00D000000000001/005000000000001';
const token={access_token:'ACCESS-SECRET',refresh_token:'REFRESH-SECRET',instance_url:'https://example.my.salesforce.com',id:identity};
function fixture(remote:typeof fetch=async()=>Response.json(token)) {
 const values=new Map<string,{value:unknown;expires?:number}>();
 const store:Store={get:<T>(key:string)=>{const row=values.get(key);return row&&(!row.expires||row.expires>Date.now())?row.value as T:undefined;},put:(key,value,expires)=>{values.set(key,{value,expires});},delete:key=>{values.delete(key);}};
 const secrets={ADMIN_ACCESS_KEY:'administrator-key-not-salesforce',TOKEN_ENCRYPTION_KEY:random(),APP_ORIGIN:origin};
 const service=new ConnectionService(store,secrets,remote);let cookie='',csrf='';
 async function request(path:string,body?:unknown,headers:Record<string,string>={}) {
  return service.handle(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'x-csrf-token':csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)}));
 }
 async function login(){const response=await request('/api/admin/login',{accessKey:secrets.ADMIN_ACCESS_KEY});assert.equal(response.status,200);cookie=response.headers.get('set-cookie')!.split(';')[0];csrf=(await response.json() as any).csrf;}
 async function setup(){await login();assert.equal((await request('/api/admin/settings',{clientId:'CLIENT-ID',clientSecret:'CLIENT-SECRET',loginUrl:'https://login.salesforce.com'})).status,200);}
 return {values,store,secrets,service,request,login,setup};
}
test('encryption is randomized, authenticated and not readable without its key',async()=>{
 const key=random(),a=await encrypt({secret:'value'},key),b=await encrypt({secret:'value'},key);assert.notEqual(a,b);assert.ok(!a.includes('value'));assert.deepEqual(await decrypt(a,key),{secret:'value'});await assert.rejects(()=>decrypt(a,random()));
});
test('PKCE matches the RFC S256 test vector',async()=>assert.equal(await hash('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
test('rejects untrusted Salesforce hosts and URL tricks',()=>{
 for(const value of ['http://login.salesforce.com','https://login.salesforce.com.evil.test','https://evil.test','https://login.salesforce.com@evil.test','https://login.salesforce.com/path','https://login.salesforce.com:444'])assert.throws(()=>salesforceOrigin(value));
 assert.equal(salesforceOrigin('https://org--uat.sandbox.my.salesforce.com'),'https://org--uat.sandbox.my.salesforce.com');
});
test('admin endpoints fail closed, require CSRF, rate limit and expire sessions',async()=>{
 const f=fixture();assert.equal((await f.request('/api/admin/status')).status,401);await f.login();
 assert.equal((await f.request('/api/admin/logout',{}, {'x-csrf-token':'bad'})).status,403);
 assert.equal((await f.request('/api/admin/logout',{}, {origin:'https://evil.test'})).status,403);
 assert.equal((await f.request('/api/admin/logout',{})).status,200);assert.equal((await f.request('/api/admin/status')).status,401);
 for(let i=0;i<5;i++)assert.equal((await f.request('/api/admin/login',{accessKey:'wrong'})).status,401);
 assert.equal((await f.request('/api/admin/login',{accessKey:'wrong'})).status,429);
});
test('missing deployment secrets cannot enable administrator endpoints',async()=>{
 const f=fixture();const service=new ConnectionService(f.store,{APP_ORIGIN:origin});assert.equal((await service.handle(new Request(origin+'/api/admin/status'))).status,503);
});
test('app settings are encrypted and client secret never appears in status',async()=>{
 const f=fixture();await f.setup();assert.ok(!JSON.stringify([...f.values]).includes('CLIENT-SECRET'));const text=await (await f.request('/api/admin/status')).text();assert.ok(text.includes('CLIENT-ID'));assert.ok(!text.includes('CLIENT-SECRET'));
});
test('successful OAuth binds state to the session, uses PKCE and persists tokens privately',async()=>{
 const calls:Request[]=[];const f=fixture(async(input,init)=>{calls.push(new Request(input,init));return String(input).includes('/token')?Response.json(token):Response.json({});});await f.setup();
 const auth=new URL((await (await f.request('/api/admin/connect',{})).json() as any).url);
 assert.equal(auth.origin,'https://login.salesforce.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
 const callback='/oauth/callback?state='+auth.searchParams.get('state')+'&code=AUTHCODE';
 const response=await f.request(callback);assert.equal(response.status,303);assert.match(response.headers.get('location')!,/result=connected/);
 const sent=new URLSearchParams(await calls[0].text());assert.equal(sent.get('grant_type'),'authorization_code');assert.equal(await hash(sent.get('code_verifier')!),auth.searchParams.get('code_challenge'));
 const status=await (await f.request('/api/admin/status')).text();assert.ok(!status.includes('SECRET'));assert.ok(status.includes('"connected":true'));assert.ok(!JSON.stringify([...f.values]).includes('REFRESH-SECRET'));
 assert.equal((await f.request(callback)).status,400);assert.equal(calls.length,2);
});
test('bad, cross-session and expired state never exchange a code',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return Response.json(token);});await f.setup();
 const url=new URL((await (await f.request('/api/admin/connect',{})).json() as any).url);
 assert.equal((await f.request('/oauth/callback?state=bad&code=x')).status,400);
 await f.login();assert.equal((await f.request('/oauth/callback?state='+url.searchParams.get('state')+'&code=x')).status,400);
 const pending=f.values.get('pending')!;pending.expires=Date.now()-1;
 assert.equal((await f.request('/oauth/callback?state='+url.searchParams.get('state')+'&code=x')).status,400);assert.equal(calls,0);
});
test('denied OAuth clears pending state without reflecting provider text',async()=>{
 const f=fixture();await f.setup();const url=new URL((await (await f.request('/api/admin/connect',{})).json() as any).url);
 const response=await f.request('/oauth/callback?state='+url.searchParams.get('state')+'&error=SECRET');assert.match(response.headers.get('location')!,/result=denied/);assert.equal(f.store.get('pending'),undefined);
});
test('refresh rotation is stored before verification and keeps the old token when omitted',async()=>{
 const normalized=normalizeTokens({...token,refresh_token:undefined},normalizeTokens(token));assert.equal(normalized.refreshToken,'REFRESH-SECRET');
 const bodies:string[]=[];const f=fixture(async(input,init)=>{if(String(input).endsWith('/token')){bodies.push(String(init?.body));return Response.json({...token,refresh_token:'ROTATED'});}return Response.json({});});await f.setup();
 f.store.put('tokens',await encrypt(normalizeTokens(token),f.secrets.TOKEN_ENCRYPTION_KEY));assert.equal((await f.request('/api/admin/refresh',{})).status,200);
 const stored=await decrypt<any>(f.store.get<string>('tokens')!,f.secrets.TOKEN_ENCRYPTION_KEY);assert.equal(stored.refreshToken,'ROTATED');assert.match(bodies[0],/REFRESH-SECRET/);
});
test('concurrent refresh calls use each rotated token exactly once',async()=>{
 const seen:string[]=[];const f=fixture(async(input,init)=>{if(String(input).endsWith('/token')){seen.push(new URLSearchParams(String(init?.body)).get('refresh_token')!);await new Promise(r=>setTimeout(r,5));return Response.json({...token,refresh_token:'ROTATED-'+seen.length});}return Response.json({});});await f.setup();f.store.put('tokens',await encrypt(normalizeTokens(token),f.secrets.TOKEN_ENCRYPTION_KEY));
 await Promise.all([f.request('/api/admin/refresh',{}),f.request('/api/admin/refresh',{})]);assert.deepEqual(seen,['REFRESH-SECRET','ROTATED-1']);
});
test('invalid grant requires reconnect and does not return upstream secret content',async()=>{
 const f=fixture(async()=>Response.json({error:'invalid_grant',error_description:'SECRET'},{status:400}));await f.setup();f.store.put('tokens',await encrypt(normalizeTokens(token),f.secrets.TOKEN_ENCRYPTION_KEY));const response=await f.request('/api/admin/refresh',{});assert.equal(response.status,409);assert.ok(!(await response.text()).includes('SECRET'));assert.equal((await (await f.request('/api/admin/status')).json() as any).needsReconnect,true);
});
test('disconnect revokes before deleting and retains tokens on transient failure',async()=>{
 let fail=true;const f=fixture(async()=>new Response('',{status:fail?503:200}));await f.setup();f.store.put('tokens',await encrypt(normalizeTokens(token),f.secrets.TOKEN_ENCRYPTION_KEY));assert.equal((await f.request('/api/admin/disconnect',{})).status,502);assert.ok(f.store.get('tokens'));fail=false;assert.equal((await f.request('/api/admin/disconnect',{})).status,200);assert.equal(f.store.get('tokens'),undefined);
});
test('expired administrator sessions cannot access connection metadata',async()=>{
 const f=fixture();await f.login();const row=[...f.values.entries()].find(([key])=>key.startsWith('session:'))![1];row.expires=Date.now()-1;assert.equal((await f.request('/api/admin/status')).status,401);
});
test('identity 401 triggers one refresh and verifies the refreshed access token',async()=>{
 let checks=0,exchanges=0;const f=fixture(async(input)=>{if(String(input).endsWith('/token')){exchanges++;return Response.json({...token,access_token:'NEW-ACCESS'});}checks++;return new Response('',{status:checks===1?401:200});});await f.setup();f.store.put('tokens',await encrypt(normalizeTokens(token),f.secrets.TOKEN_ENCRYPTION_KEY));assert.equal((await f.request('/api/admin/check',{})).status,200);assert.equal(exchanges,1);assert.equal(checks,2);
});
