import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivitySession, type Transport } from '../apps/web/src/session.ts';
class Bus implements Transport {
 events: [string,unknown][]=[]; handlers=new Map<string,(p?:unknown)=>void>();
 on(n:string,f:(p?:unknown)=>void){this.handlers.set(n,f)}
 off(n:string){this.handlers.delete(n)}
 trigger(n:string,p?:unknown){this.events.push([n,p])}
 emit(n:string,p?:unknown){this.handlers.get(n)?.(p)}
}
const event={key:'K',fields:[{name:'Id',type:'Text'},{name:'Email',type:'EmailAddress'}]};
test('registers listeners before ready; init requests event; Done updates payload',()=>{
 const bus=new Bus();const session=new ActivitySession(bus,()=>{}); session.start();
 assert.equal(bus.events[0][0],'ready');assert.ok(bus.handlers.has('initActivity'));
 bus.emit('initActivity',{id:'a',arguments:{execute:{url:'keep'}}});assert.ok(bus.events.some(e=>e[0]==='requestTriggerEventDefinition'));
 bus.emit('requestedTriggerEventDefinition',event);session.map('ContactId','{{Event.K.Id}}');session.map('EmailAddress','{{Event.K.Email}}');
 bus.emit('clickedNext');const updates=bus.events.filter(e=>e[0]==='updateActivity');assert.equal(updates.length,1);
 assert.equal((updates[0][1] as any).arguments.execute.url,'keep');assert.equal((updates[0][1] as any).metaData.isConfigured,true);
 bus.emit('clickedNext');assert.equal(bus.events.filter(e=>e[0]==='updateActivity').length,1);session.dispose();assert.equal(bus.handlers.size,0);
});
test('invalid Done signals ready and never saves',()=>{
 const bus=new Bus();const session=new ActivitySession(bus,()=>{});session.start();bus.emit('initActivity',{});bus.emit('requestedTriggerEventDefinition',null);bus.emit('clickedNext');
 assert.equal(bus.events.filter(e=>e[0]==='updateActivity').length,0);assert.ok(bus.events.filter(e=>e[0]==='ready').length>1);session.dispose();
});
test('duplicate init cannot discard current edits',()=>{
 const bus=new Bus();const session=new ActivitySession(bus,()=>{});session.start();bus.emit('initActivity',{});session.map('ContactId','chosen');bus.emit('initActivity',{});assert.equal(session.state.config.mappings.ContactId,'chosen');session.dispose();
});
test('request timeout and retry clear stale fields',async()=>{
 const bus=new Bus();const session=new ActivitySession(bus,()=>{},5);session.start();bus.emit('initActivity',{});
 await new Promise(r=>setTimeout(r,15));assert.match(session.state.status,/timed out/);
 bus.emit('requestedTriggerEventDefinition',event);assert.equal(session.state.discovery.fields.length,2);
 session.requestFields();assert.equal(session.state.discovery.fields.length,0);session.dispose();
});
test('missing parent times out without enabling save',async()=>{
 const bus=new Bus();const session=new ActivitySession(bus,()=>{},5);session.start();await new Promise(r=>setTimeout(r,15));assert.match(session.state.status,/No response/);assert.equal(session.state.initialized,false);session.dispose();
});
