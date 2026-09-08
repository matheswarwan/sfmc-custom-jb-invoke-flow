import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SalesforceClient,loginOrigin} from '../deployment/cloudflare/client-credentials.ts';
const env={SF_CLIENT_ID:'client',SF_CLIENT_SECRET:'private-secret',SF_LOGIN_URL:'https://org.my.salesforce.com'};
const path='/services/data/v66.0/actions/custom/flow';
const token=(value='access')=>Response.json({access_token:value,instance_url:env.SF_LOGIN_URL});
test('client credentials exchange uses backend settings with no interactive parameters',async()=>{
 let body='';let auth='';const client=new SalesforceClient(env,async(input,init)=>{
 if(String(input).endsWith('/token')){body=String(init?.body);assert.equal(init?.redirect,'error');return token();}
 auth=new Headers(init?.headers).get('authorization')!;return Response.json({ok:true});});
 assert.equal((await client.request(path)).status,200);const params=new URLSearchParams(body);
 assert.equal(params.get('grant_type'),'client_credentials');assert.equal(params.get('client_secret'),'private-secret');
 for(const name of ['code','redirect_uri','refresh_token','scope'])assert.equal(params.has(name),false);assert.equal(auth,'Bearer access');
});
test('concurrent calls share token acquisition and reuse the cached token',async()=>{
 let exchanges=0;const client=new SalesforceClient(env,async(input)=>{if(String(input).endsWith('/token')){exchanges++;await new Promise(r=>setTimeout(r,5));return token();}return new Response('ok');});
 await Promise.all([client.request(path),client.request(path)]);await client.request(path);assert.equal(exchanges,1);
});
test('expired cache reacquires a token without refresh_token',async()=>{
 let time=0,count=0;const client=new SalesforceClient(env,async(input)=>{if(String(input).endsWith('/token')){count++;return token();}return new Response('ok');},()=>time);
 await client.request(path);time=301000;await client.request(path);assert.equal(count,2);
});
test('401 reacquires once; repeated unauthorized response is returned without looping',async()=>{
 let exchanges=0,calls=0;const client=new SalesforceClient(env,async(input)=>{if(String(input).endsWith('/token')){exchanges++;return token();}calls++;return new Response('',{status:401});});
 assert.equal((await client.request(path)).status,401);assert.equal(exchanges,2);assert.equal(calls,2);
});
test('upstream token errors never expose response secrets',async()=>{
 const client=new SalesforceClient(env,async()=>Response.json({secret:'PRIVATE-UPSTREAM'},{status:400}));await assert.rejects(()=>client.request(path),error=>error instanceof Error&&!error.message.includes('PRIVATE-UPSTREAM')&&error.message.includes('400'));
});
test('missing settings and untrusted origins fail without sending credentials',async()=>{
 const client=new SalesforceClient({},async()=>{throw new Error('should not call');});await assert.rejects(()=>client.request(path),/incomplete/);
 for(const value of ['https://evil.test','https://org.my.salesforce.com.evil.test','http://org.my.salesforce.com','https://org.my.salesforce.com/x','https://login.salesforce.com','https://org.my.salesforce.com:444'])assert.throws(()=>loginOrigin(value));
});
test('token response must contain a supported Salesforce instance',async()=>{
 const client=new SalesforceClient(env,async()=>Response.json({access_token:'private',instance_url:'https://evil.test'}));await assert.rejects(()=>client.request(path));
});
test('invalid paths cannot redirect bearer tokens outside the data API',async()=>{
 const client=new SalesforceClient(env);for(const value of ['https://evil.test','//evil.test','/services/data/v66.0/../../oauth','/services/data/v66.0/%2e%2e/x'])await assert.rejects(()=>client.request(value));
});
