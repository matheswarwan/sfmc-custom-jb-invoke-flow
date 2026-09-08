import { discoverFields, loadConfig, object, saveActivity, validateConfig, type Discovery, type HubConfig, type JsonObject } from '@jah/shared';
export interface Transport { end?(): void; on(event: string, callback: (payload?: unknown) => void): void; off(event: string, callback: (payload?: unknown) => void): void; trigger(event: string, payload?: unknown): void }
export interface State { initialized: boolean; activity: JsonObject; config: HubConfig; discovery: Discovery; status: string; errors: Record<string,string>; saved: boolean }
export class ActivitySession {
  state: State = { initialized: false, activity: {}, config: loadConfig({}), discovery: { eventKey: '', fields: [], warnings: [] }, status: 'Waiting for Journey Builder…', errors: {}, saved: false };
  private timer?: ReturnType<typeof setTimeout>;
  private handlers: [string, (payload?: unknown) => void][] = [];
  constructor(private bus: Transport, private notify: (state: State) => void, private timeout = 10000) {}
  private publish() {
    this.state = { ...this.state }; this.notify(this.state);
    this.bus.trigger('updateButton', { button: 'next', text: 'done', enabled: this.state.initialized && !this.state.saved && !Object.keys(validateConfig(this.state.config, this.state.discovery)).length });
  }
  start() {
    this.bind('initActivity', payload => {
      if (this.state.initialized) return;
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') { this.state.status = 'Journey Builder supplied an invalid activity payload.'; this.publish(); return; }
      this.state.activity = structuredClone(object(payload));
      this.state.config = loadConfig(this.state.activity); this.state.initialized = true;
      this.bus.trigger('updateButton', { button: 'back', visible: false });
      this.requestFields();
    });
    this.bind('requestedTriggerEventDefinition', payload => {
      if (!this.state.initialized) return;
      clearTimeout(this.timer); this.state.discovery = discoverFields(payload);
      this.state.status = this.state.discovery.fields.length ? `${this.state.discovery.fields.length} Journey fields available` : 'Entry Event fields unavailable';
      this.state.errors = validateConfig(this.state.config, this.state.discovery); this.publish();
    });
    this.bind('clickedNext', () => this.done());
    this.bind('gotoStep', () => { this.bus.trigger('ready'); this.publish(); });
    this.timer = setTimeout(() => { this.state.status = 'No response from Journey Builder. Open this activity from a Journey or use the local demo.'; this.publish(); }, this.timeout);
    this.bus.trigger('ready');
  }
  private bind(name: string, fn: (payload?: unknown) => void) { this.handlers.push([name,fn]); this.bus.on(name,fn); }
  requestFields() {
    if (!this.state.initialized) return;
    clearTimeout(this.timer); this.state.discovery = { eventKey: '', fields: [], warnings: [] }; this.state.status = 'Loading Entry Event fields…'; this.publish();
    this.timer = setTimeout(() => { this.state.status = 'Entry Event request timed out. Retry after checking the Journey Entry Source.'; this.publish(); }, this.timeout);
    this.bus.trigger('requestTriggerEventDefinition');
  }
  map(name: string, value: string) {
    if (this.state.saved) return;
    this.state.config = { ...this.state.config, mappings: { ...this.state.config.mappings, [name]: value } };
    this.state.errors = validateConfig(this.state.config, this.state.discovery); this.publish();
  }
  done() {
    if (this.state.saved) return;
    this.state.errors = validateConfig(this.state.config, this.state.discovery);
    if (!this.state.initialized || Object.keys(this.state.errors).length) { this.bus.trigger('ready'); this.publish(); return; }
    const payload = saveActivity(this.state.activity, this.state.config, this.state.discovery);
    this.state.saved = true; this.state.status = 'Configuration sent to Journey Builder.'; this.publish();
    this.bus.trigger('updateActivity', payload);
  }
  dispose() { clearTimeout(this.timer); for (const [name, fn] of this.handlers) this.bus.off(name, fn); this.handlers = []; this.bus.end?.(); }
}
