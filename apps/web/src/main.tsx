import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import postmonger from 'postmonger';
import { flowInputs, validateConfig } from '@jah/shared';
import { ActivitySession, type State } from './session';
import { DemoTransport } from './demo';
import './styles.css';
const demo = window.self === window.top && new URLSearchParams(location.search).get('demo') === '1';
function App() {
  const [state,setState] = useState<State>();
  const [session,setSession] = useState<ActivitySession>();
  useEffect(() => {
    const controller = new ActivitySession(demo ? new DemoTransport() : new postmonger.Session(),setState);
    setSession(controller); setState(controller.state); controller.start();
    return () => controller.dispose();
  },[]);
  if (!state) return <main>Loading configuration…</main>;
  const errors = validateConfig(state.config,state.discovery);
  const valid = state.initialized && !Object.keys(errors).length;
  const mapped = flowInputs.filter(f => state.config.mappings[f.name]).length;
  return <main>
    <header><div className="brand-icon" aria-hidden="true">↗</div><div><p className="eyebrow">JOURNEY ACTION HUB</p><h1>Configure Salesforce Flow</h1></div><span className="badge">Phase 2</span></header>
    {demo && <aside className="notice">Local demo · Journey fields are synthetic. Done saves in this browser; reload to test reopening.</aside>}
    <section className="intro"><h2>Connect each input to Journey data</h2><p>Choose the values your Flow will receive when a contact reaches this activity.</p></section>
    <section className="card"><div className="section-title"><span className="step">1</span><h2>Choose your action</h2><span className="tag">Mock catalog</span></div>
      <div className="settings"><label>Action type<select disabled value={state.config.executorType}><option value={state.config.executorType}>{state.config.executorType === 'salesforce-flow' ? 'Salesforce Flow' : state.config.executorType}</option></select></label>
      <label>Salesforce connection<select disabled value={state.config.connectionId}><option value={state.config.connectionId}>{state.config.connectionId === 'sf-prod' ? 'Production Salesforce (mock)' : state.config.connectionId}</option></select></label>
      <label className="full">Flow<select disabled value={state.config.flowApiName}><option value={state.config.flowApiName}>{state.config.flowApiName}</option></select></label></div>
      <p className="helper">Connection and Flow discovery are placeholders. This phase configures mappings; it does not invoke Salesforce.</p>
      {['config','executor','flow'].map(key => errors[key] && <p role="alert" className="error" key={key}>{errors[key]}</p>)}
    </section>
    <section className="card"><div className="section-title"><span className="step">2</span><h2>Map Flow inputs</h2><span className="tag">{mapped} / {flowInputs.length} mapped</span></div>
      <div className="source"><div><strong>Journey Entry Event</strong><p role="status">{demo && state.saved ? 'Configuration saved in this browser.' : state.status}</p>{state.discovery.eventKey && <code>{state.discovery.eventKey}</code>}</div><button className="secondary" disabled={!state.initialized || state.saved} onClick={() => session?.requestFields()}>Refresh fields</button></div>
      {state.discovery.warnings.map(w => <p className="notice" key={w}>{w}</p>)}
      <div className="column-head"><span>FLOW INPUT</span><span>JOURNEY FIELD</span></div>
      {flowInputs.map(input => { const value = state.config.mappings[input.name] ?? ''; const missing = value && !state.discovery.fields.some(f => f.expression === value); return <div className="mapping" key={input.name}>
        <label htmlFor={input.name}><strong>{input.name}</strong><small>{input.type} · {input.required ? 'Required' : 'Optional'}</small></label>
        <div><select id={input.name} disabled={!state.initialized || state.saved || !state.discovery.fields.length} value={value} aria-invalid={!!state.errors[input.name]} aria-describedby={`${input.name}-help`} onChange={event => session?.map(input.name,event.target.value)}>
          <option value="">{input.required ? 'Select a Journey field' : 'Leave unmapped'}</option>
          {missing && <option value={value}>Unavailable: {value}</option>}
          {state.discovery.fields.map(f => <option key={f.expression} value={f.expression}>{f.path} · {f.type}</option>)}
        </select><div id={`${input.name}-help`}>{state.errors[input.name] ? <small className="error">{state.errors[input.name]}</small> : value ? <code className="expression">{value}</code> : <small className="helper">{input.required ? 'A mapping is required to continue.' : 'Omitted from the execution payload when blank.'}</small>}</div></div>
      </div>; })}
    </section>
    <footer><p>{state.saved ? (demo ? 'Saved locally. Reload to reopen.' : 'Sent to Journey Builder. Save the Journey to persist it.') : 'Map both required inputs, then select Done.'}</p><button disabled={!valid || state.saved} onClick={() => session?.done()}>Done</button></footer>
    <p className="helper">Use Journey Builder’s Cancel or close control to discard unsaved changes.</p>
    {!demo && !state.initialized && window.self === window.top && <a href="?demo=1">Open local demo</a>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
