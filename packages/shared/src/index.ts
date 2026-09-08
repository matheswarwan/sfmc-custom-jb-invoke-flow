export type JsonObject = Record<string, unknown>;
export const object = (v: unknown): JsonObject => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as JsonObject : {};
export const MOCK_FLOW = 'Customer_Onboarding_Flow';
export const MOCK_CONNECTION = 'sf-prod';
export const flowInputs = [
  { name: 'ContactId', type: 'String', required: true },
  { name: 'EmailAddress', type: 'String', required: true },
  { name: 'FirstName', type: 'String', required: false },
  { name: 'OrderNumber', type: 'String', required: false },
  { name: 'OrderAmount', type: 'Number', required: false },
] as const;
export interface HubConfig extends JsonObject {
  version: number; executorType: string; connectionId: string; flowApiName: string;
  mappings: Record<string, string>;
}
export interface JourneyField { path: string; type: string; expression: string }
export interface Discovery { eventKey: string; fields: JourneyField[]; warnings: string[] }
const segment = /^[A-Za-z_][A-Za-z0-9_-]*$/;
export function discoverFields(value: unknown): Discovery {
  const event = object(value);
  const key = typeof event.eventDefinitionKey === 'string' ? event.eventDefinitionKey : typeof event.key === 'string' ? event.key : '';
  const result: Discovery = { eventKey: key, fields: [], warnings: [] };
  if (!value) result.warnings.push('Journey Builder returned no Entry Event. Select an Entry Source and reopen this activity.');
  if (!key || !segment.test(key)) {
    result.warnings.push('A supported Entry Event key is unavailable. No binding expressions were generated.');
    return result;
  }
  const seen = new WeakSet<object>();
  const paths = new Set<string>();
  function walk(node: unknown, path: string[], depth: number) {
    if (depth > 20) { result.warnings.push('Schema depth limit reached.'); return; }
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const field = object(item);
        const name = field.name ?? field.Name;
        if (typeof name === 'string') walk(field, [...path, name], depth + 1);
      }
      return;
    }
    const schema = object(node);
    const type = String(schema.type ?? schema.fieldType ?? schema.FieldType ?? 'Unknown');
    if (type.toLowerCase() === 'array' || schema.items) {
      result.warnings.push(`Collection ${path.join('.')} is not supported for scalar Flow inputs.`); return;
    }
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [name, child] of Object.entries(object(schema.properties))) walk(child, [...path, name], depth + 1);
      return;
    }
    const children = schema.fields ?? schema.Fields;
    if (children) { walk(children, path, depth + 1); return; }
    if (!path.length || type.toLowerCase() === 'object') return;
    if (!path.every(p => segment.test(p))) {
      result.warnings.push(`Field ${path.join('.')} requires a binding syntax not supported by this mapper.`); return;
    }
    const name = path.join('.');
    if (!paths.has(name)) {
      result.fields.push({ path: name, type, expression: `{{Event.${key}.${name}}}` }); paths.add(name);
    }
  }
  // These are defensive adapters, not a promise that Postmonger supplies DE metadata.
  walk(event.schema, [], 0);
  walk(event.fields ?? event.Fields, [], 0);
  const de = object(event.dataExtension);
  walk(de.fields ?? de.Fields, [], 0);
  if (!result.fields.length) result.warnings.push('No supported Entry Event fields were supplied. This event may require authenticated metadata discovery in a later phase.');
  result.warnings = [...new Set(result.warnings)];
  return result;
}
export function loadConfig(activity: JsonObject): HubConfig {
  const saved = object(object(activity.metaData).journeyActionHub);
  const legacy = object(object(activity.configurationArguments).journeyActionHub);
  const source = Object.keys(saved).length ? saved : legacy;
  const mappings: Record<string,string> = Object.create(null);
  // Explicit saved mappings are authoritative, including an empty object.
  if (source.mappings !== undefined) {
    for (const [key, val] of Object.entries(object(source.mappings))) if (typeof val === 'string') mappings[key] = val;
  } else {
    const args = object(object(activity.arguments).execute).inArguments;
    if (Array.isArray(args)) for (const arg of args) for (const input of flowInputs) {
      const val = object(arg)[input.name]; if (typeof val === 'string') mappings[input.name] = val;
    }
  }
  return { ...source, version: typeof source.version === 'number' ? source.version : 1,
    executorType: typeof source.executorType === 'string' ? source.executorType : 'salesforce-flow',
    connectionId: typeof source.connectionId === 'string' ? source.connectionId : MOCK_CONNECTION,
    flowApiName: typeof source.flowApiName === 'string' ? source.flowApiName : MOCK_FLOW, mappings: { ...mappings } };
}
export function validateConfig(config: HubConfig, discovery: Discovery): Record<string,string> {
  const errors: Record<string,string> = {};
  if (config.version !== 1) errors.config = 'This configuration version requires a newer app.';
  if (config.executorType !== 'salesforce-flow') errors.executor = 'This phase supports Salesforce Flow configuration only.';
  if (config.connectionId !== MOCK_CONNECTION || config.flowApiName !== MOCK_FLOW) errors.flow = 'The saved connection or Flow is outside the mock catalog. It has been preserved; live discovery is required to edit it.';
  for (const input of flowInputs) {
    const value = config.mappings[input.name];
    if (!value) { if (input.required) errors[input.name] = 'Select a Journey field.'; continue; }
    const field = discovery.fields.find(f => f.expression === value);
    if (!field) { errors[input.name] = 'Saved field is unavailable in the current Entry Event. Select a current field.'; continue; }
    if (input.type === 'Number' && !['number','integer','decimal','double','float','int','long'].includes(field.type.toLowerCase())) errors[input.name] = 'Select a numeric Journey field.';
  }
  return errors;
}
export function saveActivity(activity: JsonObject, config: HubConfig, discovery: Discovery): JsonObject {
  const errors = validateConfig(config, discovery);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  const copy = structuredClone(activity);
  const args = object(copy.arguments), execute = object(args.execute);
  const owned = new Set<string>(flowInputs.map(f => f.name));
  // Remove only fields owned by this mock schema. Keep foreign arguments, including mixed objects.
  const previous = Array.isArray(execute.inArguments) ? execute.inArguments : [];
  const retained = previous.map(arg => Object.fromEntries(Object.entries(object(arg)).filter(([key]) => !owned.has(key)))).filter(arg => Object.keys(arg).length);
  const mapped = flowInputs.filter(f => config.mappings[f.name]).map(f => ({ [f.name]: config.mappings[f.name] }));
  copy.arguments = { ...args, execute: { ...execute, inArguments: [...retained, ...mapped] } };
  copy.metaData = { ...object(copy.metaData), isConfigured: true, journeyActionHub: structuredClone(config) };
  return copy;
}
export type ExecutorType = 'salesforce-flow' | 'rest-api';
export interface JourneyExecutionContext { inArguments: JsonObject[]; journeyId?: string; activityObjectID?: string }
export interface ExecutorResult { status: 'not-implemented'; message: string }
