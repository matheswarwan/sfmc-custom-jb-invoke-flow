import { limitedText, salesforceOrigin } from './security';
export interface AppSettings { clientId: string; clientSecret: string; loginUrl: string }
export interface TokenSet { accessToken: string; refreshToken: string; instanceUrl: string; identityUrl: string; connectedAt: string; checkedAt?: string; needsReconnect?: boolean }
export type RemoteFetch = typeof fetch;
export function validateSettings(value: Record<string,unknown>): AppSettings {
  if(typeof value.clientId!=='string'||!value.clientId.trim()||value.clientId.length>512) throw new Error('Client ID is required.');
  if(typeof value.clientSecret!=='string'||!value.clientSecret.trim()||value.clientSecret.length>2048) throw new Error('Client secret is required.');
  return {clientId:value.clientId.trim(),clientSecret:value.clientSecret.trim(),loginUrl:salesforceOrigin(String(value.loginUrl))};
}
export function authorizationUrl(app:AppSettings,redirectUri:string,state:string,challenge:string):string {
  const url=new URL('/services/oauth2/authorize',app.loginUrl);
  url.search=new URLSearchParams({response_type:'code',client_id:app.clientId,redirect_uri:redirectUri,state,code_challenge:challenge,code_challenge_method:'S256',scope:'api refresh_token id'}).toString();
  return url.href;
}
export class SalesforceError extends Error { constructor(public readonly kind:'reconnect'|'temporary') { super(kind==='reconnect'?'Salesforce authorization expired or was rejected. Reconnect the org.':'Salesforce is temporarily unavailable. Try again.'); } }
export async function tokenRequest(app:AppSettings,params:Record<string,string>,remote:RemoteFetch=fetch):Promise<Record<string,unknown>> {
  const response=await remote(`${app.loginUrl}/services/oauth2/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:app.clientId,client_secret:app.clientSecret})});
  const text=await limitedText(response);
  let payload:Record<string,unknown>;try{payload=JSON.parse(text);}catch{throw new SalesforceError('temporary');}
  if(!response.ok) throw new SalesforceError(payload.error==='invalid_grant'||payload.error==='invalid_client'?'reconnect':'temporary');
  return payload;
}
export function normalizeTokens(payload:Record<string,unknown>,previous?:TokenSet):TokenSet {
  if(typeof payload.access_token!=='string'||!payload.access_token)throw new SalesforceError('temporary');
  const refresh=typeof payload.refresh_token==='string'&&payload.refresh_token?payload.refresh_token:previous?.refreshToken;
  if(!refresh)throw new Error('Salesforce did not issue a refresh token. Enable refresh_token scope and authorize again.');
  const instance=salesforceOrigin(String(payload.instance_url??previous?.instanceUrl));
  const identity=String(payload.id??previous?.identityUrl??'');
  const identityUrl=new URL(identity);salesforceOrigin(identityUrl.origin);
  if(!/^\/id\/[a-zA-Z0-9]{15,18}\/[a-zA-Z0-9]{15,18}$/.test(identityUrl.pathname)||identityUrl.search||identityUrl.hash)throw new SalesforceError('temporary');
  return {accessToken:payload.access_token,refreshToken:refresh,instanceUrl:instance,identityUrl:identity,connectedAt:previous?.connectedAt??new Date().toISOString(),needsReconnect:false};
}
export async function checkIdentity(tokens:TokenSet,remote:RemoteFetch=fetch):Promise<boolean> {
  const response=await remote(tokens.identityUrl,{headers:{Authorization:`Bearer ${tokens.accessToken}`},redirect:'error',signal:AbortSignal.timeout(8000)});
  await response.body?.cancel();
  if(response.status===401)return false;
  if(!response.ok)throw new SalesforceError('temporary');
  return true;
}
export async function revoke(app:AppSettings,tokens:TokenSet,remote:RemoteFetch=fetch):Promise<void> {
  const response=await remote(`${app.loginUrl}/services/oauth2/revoke`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:tokens.refreshToken}),redirect:'error',signal:AbortSignal.timeout(8000)});
  const text=await limitedText(response);
  if(!response.ok && !(response.status===400 && text.includes('invalid_token')))throw new SalesforceError('temporary');
}
