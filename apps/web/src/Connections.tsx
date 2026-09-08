import React, {useEffect,useState} from 'react';
interface Status {authenticated?:boolean;csrf?:string;configured?:boolean;loginUrl?:string;clientId?:string;callbackUrl?:string;connected?:boolean;needsReconnect?:boolean;instanceUrl?:string;connectedAt?:string;checkedAt?:string;setupRequired?:boolean}
export function Connections() {
  const [status,setStatus]=useState<Status>({});const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');const [accessKey,setAccessKey]=useState('');
  const [clientId,setClientId]=useState('');const [clientSecret,setClientSecret]=useState('');const [loginUrl,setLoginUrl]=useState('https://login.salesforce.com');
  async function refresh(){
    const response=await fetch('/api/admin/status',{cache:'no-store'});const data=await response.json();
    if(response.status===401){setStatus({});return;}
    if(!response.ok){setStatus({setupRequired:!!data.setupRequired});setMessage(data.error??'Connection status unavailable.');return;}
    setStatus(data);setClientId(data.clientId??'');setLoginUrl(data.loginUrl??'https://login.salesforce.com');
  }
  useEffect(()=>{refresh().catch(()=>setMessage('Unable to reach the server.')).finally(()=>setLoading(false));
    const result=new URLSearchParams(location.search).get('result');
    if(result)setMessage(result==='connected'?'Salesforce connected successfully.':result==='denied'?'Salesforce authorization was cancelled.':'Salesforce authorization failed. Check app settings and retry.');
    if(result)history.replaceState(null,'','/connections');
  },[]);
  async function action(path:string,body:unknown={}) {
    setBusy(true);setMessage('');
    try{
      const response=await fetch(`/api/admin/${path}`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':status.csrf??''},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok){if(response.status===401)setStatus({});throw new Error(data.error??'Request failed.');}
      if(path==='connect'){location.assign(data.url);return;}
      setAccessKey('');setClientSecret('');await refresh();
      setMessage(path==='settings'?'App settings saved securely. You can now authorize Salesforce.':path==='disconnect'?'Salesforce access revoked and stored tokens removed.':path==='check'||path==='refresh'?'Salesforce connection verified.':'');
    }catch(error){setMessage(error instanceof Error?error.message:'Request failed.');}finally{setBusy(false);}
  }
  return <main className="jah-shell slds-p-around_medium">
    <header className="slds-page-header"><p className="slds-text-title_caps">Journey Action Hub · Phase 3</p><h1 className="slds-page-header__title slds-m-top_x-small">Salesforce connection</h1></header>
    <p className="slds-m-vertical_medium">Manage the Salesforce authorization used by this deployment. Flow discovery and execution will be added in the following phases.</p>
    {message&&<div className="slds-box slds-theme_shade slds-m-bottom_medium" role="status">{message}</div>}
    {loading?<p role="status">Checking connection…</p>:status.setupRequired?<section className="slds-card slds-p-around_medium"><h2 className="slds-text-heading_small">Administrator setup required</h2><p className="slds-m-top_small">Configure the administrator access key and encryption key in Cloudflare before using this page. See the Phase 3 setup guide in the repository.</p></section>:!status.authenticated?<form className="slds-card slds-p-around_medium" onSubmit={event=>{event.preventDefault();void action('login',{accessKey});}}>
      <h2 className="slds-text-heading_small">Administrator sign-in</h2>
      <div className="slds-form-element slds-m-vertical_medium"><label className="slds-form-element__label" htmlFor="access-key">Administrator access key</label><div className="slds-form-element__control"><input className="slds-input" id="access-key" type="password" required autoComplete="current-password" value={accessKey} onChange={e=>setAccessKey(e.target.value)} /></div><p className="slds-form-element__help">This is your Journey Action Hub key, not your Salesforce password.</p></div>
      <button className="slds-button slds-button_brand" disabled={busy}>Sign in</button>
    </form>:<>
      <section className="slds-card slds-p-around_medium"><div className="jah-source"><h2 className="slds-text-heading_small">Connection: sf-prod</h2><span className={`slds-badge ${status.connected?'slds-theme_success':''}`}>{status.connected?'Connected':status.needsReconnect?'Reconnect required':'Not connected'}</span></div>
        {status.instanceUrl&&<p className="slds-m-top_small">Org: {status.instanceUrl}</p>}
        {status.checkedAt&&<p className="slds-m-top_small">Last verified: {new Date(status.checkedAt).toLocaleString()}</p>}
        <div className="slds-button-group slds-m-top_medium" role="group" aria-label="Connection actions">
          {!status.connected&&!status.needsReconnect&&<button className="slds-button slds-button_brand" disabled={busy||!status.configured} onClick={()=>void action('connect')}>Authorize Salesforce</button>}
          {status.connected&&<><button className="slds-button slds-button_neutral" disabled={busy} onClick={()=>void action('check')}>Test connection</button><button className="slds-button slds-button_neutral" disabled={busy} onClick={()=>void action('refresh')}>Refresh authorization</button></>}
          {(status.connected||status.needsReconnect)&&<button className="slds-button slds-button_destructive" disabled={busy} onClick={()=>{if(window.confirm('Revoke Salesforce authorization and remove the stored tokens?'))void action('disconnect');}}>Disconnect</button>}
        </div>
      </section>
      <form className="slds-card slds-p-around_medium slds-m-top_medium" onSubmit={e=>{e.preventDefault();void action('settings',{clientId,clientSecret,loginUrl});}}>
        <h2 className="slds-text-heading_small">Salesforce External Client App</h2>
        <p className="slds-m-vertical_small">Enable the web server flow with PKCE and scopes <code>api</code>, <code>refresh_token</code>, and <code>id</code>. Require the client secret for code exchange and refresh.</p>
        <p className="slds-m-bottom_medium">Callback URL: <code className="jah-expression">{status.callbackUrl}</code></p>
        <fieldset disabled={busy||!!status.connected||!!status.needsReconnect}>
          <div className="slds-form-element slds-m-bottom_small"><label className="slds-form-element__label" htmlFor="login-url">Salesforce login endpoint</label><div className="slds-form-element__control"><input id="login-url" className="slds-input" type="url" required value={loginUrl} onChange={e=>setLoginUrl(e.target.value)} /></div><p className="slds-form-element__help">Production: https://login.salesforce.com · Sandbox: https://test.salesforce.com · or your My Domain URL.</p></div>
          <div className="slds-form-element slds-m-bottom_small"><label className="slds-form-element__label" htmlFor="client-id">Consumer key / client ID</label><div className="slds-form-element__control"><input id="client-id" className="slds-input" required autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)} /></div></div>
          <div className="slds-form-element slds-m-bottom_medium"><label className="slds-form-element__label" htmlFor="client-secret">Consumer secret / client secret</label><div className="slds-form-element__control"><input id="client-secret" className="slds-input" type="password" required autoComplete="off" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} /></div><p className="slds-form-element__help">{status.configured?'A secret is stored. Enter it again only when changing settings.':'Stored encrypted on the backend; never returned to the browser.'}</p></div>
          <button className="slds-button slds-button_neutral">Save app settings</button>
        </fieldset>
        {(status.connected||status.needsReconnect)&&<p className="slds-m-top_small">Disconnect before changing the app settings.</p>}
      </form>
      <button className="slds-button slds-button_neutral slds-m-top_medium" disabled={busy} onClick={()=>void action('logout')}>Sign out</button>
    </>}
    <p className="slds-m-top_large"><a href="/?demo=1">Return to mapper demo</a></p>
  </main>;
}
