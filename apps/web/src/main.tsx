import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import postmonger from 'postmonger';
import { flowInputs, validateConfig } from '@jah/shared';
import { ActivitySession, type State } from './session';
import { DemoTransport } from './demo';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import './styles.css';
const demo = window.self === window.top && new URLSearchParams(location.search).get('demo') === '1';
function CatalogField({ label, value }: { label: string; value: string }) {
  const id = `catalog-${label.replaceAll(' ', '-').toLowerCase()}`;
  return <div className="slds-form-element">
    <label className="slds-form-element__label" htmlFor={id}>{label}</label>
    <div className="slds-form-element__control"><div className="slds-select_container">
      <select className="slds-select" id={id} disabled value={value}><option value={value}>{value}</option></select>
    </div></div>
  </div>;
}
function App() {
  const [state, setState] = useState<State>();
  const [session, setSession] = useState<ActivitySession>();
  useEffect(() => {
    const controller = new ActivitySession(demo ? new DemoTransport() : new postmonger.Session(), setState);
    setSession(controller); setState(controller.state); controller.start();
    return () => controller.dispose();
  }, []);
  if (!state) return <main className="jah-shell slds-p-around_large" role="status">Loading configuration…</main>;
  const errors = validateConfig(state.config, state.discovery);
  const valid = state.initialized && !Object.keys(errors).length;
  const mapped = flowInputs.filter(f => state.config.mappings[f.name]).length;
  return <main className="jah-shell slds-p-around_medium">
    <header className="slds-page-header">
      <div className="slds-page-header__row"><div className="slds-page-header__col-title">
        <p className="slds-text-title_caps slds-m-bottom_x-small">Journey Action Hub</p>
        <h1 className="slds-page-header__title">Configure Salesforce Flow</h1>
      </div><div className="slds-page-header__col-actions"><span className="slds-badge">Phase 2</span></div></div>
    </header>
    {demo && <aside className="slds-notify slds-notify_alert slds-theme_warning slds-m-top_medium jah-notice">Local demo · Journey fields are synthetic. Done saves in this browser; reload to test reopening.</aside>}
    <section className="slds-m-vertical_large">
      <h2 className="slds-text-heading_small">Connect each input to Journey data</h2>
      <p className="slds-text-body_regular slds-m-top_x-small">Choose the values your Flow will receive when a contact reaches this activity.</p>
    </section>
    <section className="slds-card" aria-labelledby="action-heading">
      <div className="slds-card__header slds-grid"><h2 className="slds-card__header-title" id="action-heading">1. Choose your action</h2><span className="slds-badge slds-m-left_auto">Mock catalog</span></div>
      <div className="slds-card__body slds-card__body_inner">
        <div className="jah-catalog">
          <CatalogField label="Action type" value={state.config.executorType === 'salesforce-flow' ? 'Salesforce Flow' : state.config.executorType} />
          <CatalogField label="Salesforce connection" value={state.config.connectionId === 'sf-prod' ? 'Production Salesforce (mock)' : state.config.connectionId} />
          <div className="jah-full"><CatalogField label="Flow" value={state.config.flowApiName} /></div>
        </div>
        <p className="slds-text-color_weak slds-m-top_small">Connection and Flow discovery are placeholders. This phase configures mappings; it does not invoke Salesforce.</p>
        {['config', 'executor', 'flow'].map(key => errors[key] && <p role="alert" className="slds-text-color_error slds-m-top_small" key={key}>{errors[key]}</p>)}
      </div>
    </section>
    <section className="slds-card slds-m-top_medium" aria-labelledby="mapping-heading">
      <div className="slds-card__header slds-grid"><h2 className="slds-card__header-title" id="mapping-heading">2. Map Flow inputs</h2><span className="slds-badge slds-m-left_auto">{mapped} / {flowInputs.length} mapped</span></div>
      <div className="slds-card__body slds-card__body_inner">
        <div className="slds-box slds-theme_shade slds-m-bottom_medium jah-source">
          <div><h3 className="slds-text-title_bold">Journey Entry Event</h3><p role="status" className="slds-m-top_x-small">{demo && state.saved ? 'Configuration saved in this browser.' : state.status}</p>{state.discovery.eventKey && <code className="jah-expression">{state.discovery.eventKey}</code>}</div>
          <button className="slds-button slds-button_neutral" disabled={!state.initialized || state.saved} onClick={() => session?.requestFields()}>Refresh fields</button>
        </div>
        {state.discovery.warnings.map(w => <p className="slds-notify slds-notify_alert slds-theme_warning slds-m-bottom_small jah-notice" key={w}>{w}</p>)}
        <div className="jah-column-head slds-text-title_caps slds-border_bottom slds-p-bottom_small"><span>Flow input</span><span>Journey field</span></div>
        <div className="slds-form">
          {flowInputs.map(input => {
            const value = state.config.mappings[input.name] ?? '';
            const missing = value && !state.discovery.fields.some(f => f.expression === value);
            const error = state.errors[input.name];
            return <div className={`slds-form-element jah-mapping slds-p-vertical_medium slds-border_bottom${error ? ' slds-has-error' : ''}`} key={input.name}>
              <label className="slds-form-element__label" htmlFor={input.name}>
                {input.required && <abbr className="slds-required" title="required">* </abbr>}<strong>{input.name}</strong>
                <span className="jah-field-meta slds-text-color_weak">{input.type} · {input.required ? 'Required' : 'Optional'}</span>
              </label>
              <div className="slds-form-element__control">
                <div className="slds-select_container"><select className="slds-select" id={input.name} required={input.required} disabled={!state.initialized || state.saved || !state.discovery.fields.length} value={value} aria-invalid={!!error} aria-describedby={`${input.name}-help`} onChange={event => session?.map(input.name, event.target.value)}>
                  <option value="">{input.required ? 'Select a Journey field' : 'Leave unmapped'}</option>
                  {missing && <option value={value}>Unavailable: {value}</option>}
                  {state.discovery.fields.map(f => <option key={f.expression} value={f.expression}>{f.path} · {f.type}</option>)}
                </select></div>
                <div id={`${input.name}-help`} className="slds-form-element__help">{error || (value ? <code className="jah-expression">{value}</code> : <span className="slds-text-color_weak">{input.required ? 'A mapping is required to continue.' : 'Omitted from the execution payload when blank.'}</span>)}</div>
              </div>
            </div>;
          })}
        </div>
      </div>
    </section>
    <footer className="jah-footer slds-m-top_medium slds-p-around_medium slds-box slds-theme_default">
      <p role="status" className="slds-text-color_weak">{state.saved ? (demo ? 'Saved locally. Reload to reopen.' : 'Sent to Journey Builder. Save the Journey to persist it.') : 'Map both required inputs, then select Done.'}</p>
      <button className="slds-button slds-button_brand" disabled={!valid || state.saved} onClick={() => session?.done()}>Done</button>
    </footer>
    <p className="slds-text-color_weak slds-m-top_small">Use Journey Builder’s Cancel or close control to discard unsaved changes.</p>
    {!demo && !state.initialized && window.self === window.top && <a className="slds-m-top_small slds-show" href="?demo=1">Open local demo</a>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
