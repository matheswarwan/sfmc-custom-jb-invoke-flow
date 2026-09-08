import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deployment/cloudflare/worker.ts';
import { readFileSync } from 'node:fs';
const template = readFileSync(new URL('../jb-activity/config.json',import.meta.url),'utf8');
const env={ASSETS:{fetch:async(request:Request)=>new Response(new URL(request.url).pathname === '/config.json' ? template : 'asset')}};
test('Cloudflare config uses deployed HTTPS origin and preserves package key',async()=>{
 const response=await worker.fetch(new Request('https://hub.example/config.json'),{...env,APPLICATION_EXTENSION_KEY:'my-package'});
 const body:any=await response.json();assert.equal(body.arguments.execute.url,'https://hub.example/activity/execute');assert.equal(body.configurationArguments.save.url,'https://hub.example/activity/save');assert.equal(body.configurationArguments.applicationExtensionKey,'my-package');assert.equal(body.metaData.isConfigured,false);
});
test('Cloudflare keeps activation and execution disabled',async()=>{
 for(const [path,status] of [['execute',501],['publish',422],['validate',422],['unknown',404]] as const) assert.equal((await worker.fetch(new Request(`https://hub.example/activity/${path}`,{method:'POST'}),env)).status,status);
 assert.equal((await worker.fetch(new Request('https://hub.example/activity/save'),env)).status,405);
});
test('Cloudflare serves UI assets and reports package setup truthfully',async()=>{
 assert.equal(await (await worker.fetch(new Request('https://hub.example/'),env)).text(),'asset');
 const health:any=await (await worker.fetch(new Request('https://hub.example/health'),env)).json();assert.equal(health.runtimeEnabled,false);assert.equal(health.packageConfigured,false);
});
test('removed administrator and OAuth routes cannot access historical credentials',async()=>{
 for(const path of ['/connections','/api/admin/status','/api/admin/login','/oauth/callback'])assert.equal((await worker.fetch(new Request('https://hub.example'+path),env)).status,410);
 const body:any=await (await worker.fetch(new Request('https://hub.example/health'),{...env,SF_CLIENT_ID:'id',SF_CLIENT_SECRET:'secret',SF_LOGIN_URL:'https://org.my.salesforce.com'})).json();assert.equal(body.authMethod,'client_credentials');assert.equal(body.salesforceConfigured,true);assert.ok(!JSON.stringify(body).includes('secret'));
});
