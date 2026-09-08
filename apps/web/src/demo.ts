import type { Transport } from './session';
export const demoEvent = { key: 'DEMO-ENTRY', schema: { fields: [
  { name: 'ContactId', type: 'Text' }, { name: 'EmailAddress', type: 'EmailAddress' },
  { name: 'FirstName', type: 'Text' }, { name: 'OrderNumber', type: 'Text' }, { name: 'OrderAmount', type: 'Decimal' },
  { name: 'Address', type: 'Object', fields: [{ name: 'City', type: 'Text' }] },
] } };
export class DemoTransport implements Transport {
  private listeners = new Map<string, Set<(payload?: unknown) => void>>();
  private initialized = false;
  on(name: string, callback: (payload?: unknown) => void) { if (!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name)!.add(callback); }
  off(name: string, callback: (payload?: unknown) => void) { this.listeners.get(name)?.delete(callback); }
  trigger(name: string, payload?: unknown) {
    if (name === 'ready' && !this.initialized) {
      this.initialized = true;
      let activity = {}; try { activity = JSON.parse(localStorage.getItem('jah-demo') ?? '{}'); } catch { /* Ignore corrupt demo storage. */ }
      queueMicrotask(() => this.emit('initActivity', activity));
    }
    if (name === 'requestTriggerEventDefinition') queueMicrotask(() => this.emit('requestedTriggerEventDefinition', demoEvent));
    if (name === 'updateActivity') localStorage.setItem('jah-demo', JSON.stringify(payload));
  }
  private emit(name: string, payload: unknown) { this.listeners.get(name)?.forEach(fn => fn(payload)); }
}
