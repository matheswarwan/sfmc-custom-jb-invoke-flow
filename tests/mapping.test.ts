import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverFields, loadConfig, saveActivity, validateConfig } from '../packages/shared/src/index.ts';
const event = { eventDefinitionKey: 'ENTRY-123', schema: { fields: [{ name: 'ContactId', type: 'Text' }, { name: 'EmailAddress', type: 'EmailAddress' }, { name: 'Amount', type: 'Decimal' }] } };
const discovery = discoverFields(event);
const config = () => ({ ...loadConfig({}), mappings: { ContactId: '{{Event.ENTRY-123.ContactId}}', EmailAddress: '{{Event.ENTRY-123.EmailAddress}}' } });
test('extracts event fields and case-sensitive expressions', () => assert.deepEqual(discovery.fields.map(f => f.expression), ['{{Event.ENTRY-123.ContactId}}','{{Event.ENTRY-123.EmailAddress}}','{{Event.ENTRY-123.Amount}}']));
test('recurses JSON schema objects and field lists', () => {
 const result = discoverFields({ key: 'K', schema: { properties: { Address: { type: 'object', properties: { City: { type: 'string' } } } } }, fields: [{ name: 'Order', fields: [{ name: 'Total', type: 'Number' }] }] });
 assert.deepEqual(result.fields.map(f => f.path), ['Address.City','Order.Total']);
});
test('supports DE field descriptors without guessing metadata properties', () => {
 assert.equal(discoverFields({ key: 'K', name: 'not-a-field', dataExtension: { Fields: [{ Name: 'Email', FieldType: 'EmailAddress' }] } }).fields[0].path,'Email');
 assert.equal(discoverFields({ key: 'K', name: 'not-a-field', dataExtensionId: 'id' }).fields.length,0);
});
test('null, missing key, and malformed responses are safe', () => {
 for (const value of [null,{},'bad',{ fields: event.schema.fields },{key:'bad.key',fields:event.schema.fields}]) assert.equal(discoverFields(value).fields.length,0);
});
test('collections and unsafe path segments are excluded', () => {
 const d = discoverFields({key:'K',schema:{properties:{Rows:{type:'array',items:{type:'string'}},'First Name':{type:'string'},Okay:{type:'string'}}}});
 assert.deepEqual(d.fields.map(f=>f.path),['Okay']); assert.equal(d.warnings.length,2);
});
test('cyclic and excessive-depth metadata terminates', () => {
 const schema: any = { properties: {} }; schema.properties.Loop = schema;
 assert.equal(discoverFields({key:'K',schema}).fields.length,0);
});
test('deduplicates fields', () => assert.equal(discoverFields({...event,fields:event.schema.fields}).fields.length,3));
test('requires mappings and rejects stale bindings', () => {
 assert.ok(validateConfig(loadConfig({}),discovery).ContactId);
 assert.deepEqual(validateConfig(config(),discovery),{});
 assert.ok(validateConfig(config(),discoverFields({...event,eventDefinitionKey:'NEW'})).EmailAddress);
});
test('numeric input rejects text and accepts decimal', () => {
 const c=config(); (c.mappings as Record<string,string>).OrderAmount=c.mappings.ContactId;
 assert.ok(validateConfig(c,discovery).OrderAmount);
 (c.mappings as Record<string,string>).OrderAmount='{{Event.ENTRY-123.Amount}}'; assert.deepEqual(validateConfig(c,discovery),{});
});
test('preserves foreign configuration and mixed arguments without mutating init payload', () => {
 const activity = { id:'id',outcomes:[{key:'next'}],metaData:{icon:'icon.svg',journeyActionHub:{custom:'keep'}},arguments:{other:12,execute:{url:'https://example.test/execute',timeout:40000,outArguments:[{status:''}],inArguments:[{ContactId:'old',foreign:7},{FirstName:'old'},{tokenReference:'ref'}]}},configurationArguments:{save:{url:'https://example.test/save'},secretReference:'ref'}};
 const before=structuredClone(activity); const saved:any=saveActivity(activity,config(),discovery);
 assert.deepEqual(activity,before); assert.equal(saved.arguments.execute.url,activity.arguments.execute.url);
 assert.equal(saved.arguments.execute.timeout,40000); assert.deepEqual(saved.configurationArguments,activity.configurationArguments);
 assert.deepEqual(saved.outcomes,activity.outcomes); assert.equal(saved.metaData.icon,'icon.svg'); assert.equal(saved.metaData.isConfigured,true);
 assert.deepEqual(saved.arguments.execute.inArguments,[{foreign:7},{tokenReference:'ref'},{ContactId:config().mappings.ContactId},{EmailAddress:config().mappings.EmailAddress}]);
});
test('save and reopen round-trip is idempotent', () => {
 const c=config(); const saved=saveActivity({},c,discovery);
 assert.deepEqual(loadConfig(saved),c); assert.deepEqual(saveActivity(saved,loadConfig(saved),discovery),saved);
});
test('explicit empty mappings win over legacy inArguments', () => {
 assert.deepEqual(Object.keys(loadConfig({metaData:{journeyActionHub:{mappings:{}}},arguments:{execute:{inArguments:[{ContactId:'old'}]}}}).mappings),[]);
});
test('loads legacy inArguments and app config while retaining unknown properties', () => {
 assert.equal(loadConfig({arguments:{execute:{inArguments:[{ContactId:'old'}]}}}).mappings.ContactId,'old');
 assert.equal(loadConfig({configurationArguments:{journeyActionHub:{connectionId:'custom',extra:42}}}).extra,42);
});
test('unsupported saved configurations remain intact and cannot be overwritten', () => {
 for (const patch of [{version:2},{executorType:'rest-api'},{flowApiName:'Other'},{connectionId:'Other'}]) {
  const c={...config(),...patch}; assert.throws(()=>saveActivity({},c,discovery));
 }
});
test('invalid save throws before changing payload', () => assert.throws(()=>saveActivity({},loadConfig({}),discovery)));
