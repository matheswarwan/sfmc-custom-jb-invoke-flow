import { authorizationUrl, checkIdentity, normalizeTokens, revoke, SalesforceError, tokenRequest, validateSettings, type AppSettings, type RemoteFetch, type TokenSet } from './salesforce';
import { cookie, decrypt, encrypt, equalSecret, hash, json, limitedText, random, sessionCookie } from './security';
export interface Store { get<T>(key:string):T|undefined; put(key:string,value:unknown,expires?:number):void; delete(key:string):void }
export interface Secrets { ADMIN_ACCESS_KEY?:string; TOKEN_ENCRYPTION_KEY?:string; APP_ORIGIN:string }
interface Session { csrf:string; expires:number }
interface Pending { verifier:string; sessionHash:string; redirectUri:string; expires:number }
export class ConnectionService {
  private tail:Promise<unknown>=Promise.resolve();
  constructor(private store:Store,private env:Secrets,private remote:RemoteFetch=fetch) {}
  handle(request:Request):Promise<Response> {
    // Serializes token rotation and connection changes for this one org, without holding a storage lock over network I/O.
    const job=this.tail.then(()=>this.route(request));this.tail=job.catch(()=>{});return job;
  }
  private async route(request:Request):Promise<Response> {
    try {
      const url=new URL(request.url);
      if(url.origin!==this.env.APP_ORIGIN)return json({error:'Invalid application origin.'},403);
      if(!this.env.ADMIN_ACCESS_KEY||!this.env.TOKEN_ENCRYPTION_KEY)return json({error:'Administrator setup is required in Cloudflare Secrets.',setupRequired:true},503);
      if(request.method==='POST' && request.headers.get('origin')!==this.env.APP_ORIGIN)return json({error:'Request origin rejected.'},403);
      if(url.pathname==='/api/admin/login' && request.method==='POST') {
        const rateKey=`login:${await hash(request.headers.get('cf-connecting-ip')??'local')}`;
        const rate=this.store.get<{count:number;until:number}>(rateKey)??{count:0,until:Date.now()+60000};
        if(rate.count>=5 && rate.until>Date.now())return json({error:'Too many attempts. Try again in one minute.'},429);
        this.store.put(rateKey,{count:rate.count+1,until:rate.until},rate.until);
        const body=JSON.parse(await limitedText(request,4096));
        if(typeof body.accessKey!=='string'||!await equalSecret(body.accessKey,this.env.ADMIN_ACCESS_KEY))return json({error:'Invalid administrator access key.'},401);
        const id=random(),session={csrf:random(),expires:Date.now()+1800000};
        this.store.put(`session:${await hash(id)}`,session,session.expires);
        this.store.delete(rateKey);
        return json({authenticated:true,csrf:session.csrf},200,{'set-cookie':sessionCookie(id)});
      }
      const id=cookie(request,'__Host-jah-admin');const sessionHash=await hash(id);
      const session=this.store.get<Session>(`session:${sessionHash}`);
      if(!id||!session||session.expires<Date.now())return json({error:'Sign in to manage Salesforce connections.'},401,{'set-cookie':sessionCookie('',0)});
      if(request.method==='POST' && !await equalSecret(request.headers.get('x-csrf-token')??'',session.csrf))return json({error:'Request token rejected.'},403);
      if(url.pathname==='/api/admin/status' && request.method==='GET') {
        const app=await this.load<AppSettings>('app');const tokens=await this.load<TokenSet>('tokens');
        return json({authenticated:true,csrf:session.csrf,connectionId:'sf-prod',configured:!!app,loginUrl:app?.loginUrl,clientId:app?.clientId,callbackUrl:`${this.env.APP_ORIGIN}/oauth/callback`,connected:!!tokens&&!tokens.needsReconnect,needsReconnect:!!tokens?.needsReconnect,instanceUrl:tokens?.instanceUrl,connectedAt:tokens?.connectedAt,checkedAt:tokens?.checkedAt});
      }
      if(url.pathname==='/api/admin/logout' && request.method==='POST') {
        this.store.delete(`session:${sessionHash}`);return json({authenticated:false},200,{'set-cookie':sessionCookie('',0)});
      }
      if(url.pathname==='/api/admin/settings' && request.method==='POST') {
        if(this.store.get('tokens'))return json({error:'Disconnect the current org before changing app settings.'},409);
        const app=validateSettings(JSON.parse(await limitedText(request,4096)));
        await this.save('app',app);this.store.delete('pending');return json({configured:true});
      }
      if(url.pathname==='/api/admin/connect' && request.method==='POST') {
        const app=await this.load<AppSettings>('app');if(!app)return json({error:'Save Salesforce app settings first.'},409);
        if(this.store.get('tokens'))return json({error:'Disconnect the current org before connecting another.'},409);
        const state=random(),verifier=random(),expires=Date.now()+600000;
        await this.save('pending',{stateHash:await hash(state),verifier,sessionHash,redirectUri:`${this.env.APP_ORIGIN}/oauth/callback`,expires},expires);
        return json({url:authorizationUrl(app,`${this.env.APP_ORIGIN}/oauth/callback`,state,await hash(verifier))});
      }
      if(url.pathname==='/oauth/callback' && request.method==='GET') {
        const pending=await this.load<Pending&{stateHash:string}>('pending');
        if(!pending||pending.expires<Date.now()||pending.sessionHash!==sessionHash||!await equalSecret(await hash(url.searchParams.get('state')??''),pending.stateHash))return json({error:'Authorization expired or state did not match. Start again.'},400);
        this.store.delete('pending'); // One-time use, before any external token exchange.
        if(url.searchParams.has('error'))return this.redirect('denied');
        const code=url.searchParams.get('code');if(!code||code.length>4096)return this.redirect('failed');
        const app=await this.load<AppSettings>('app');if(!app)return this.redirect('failed');
        try {
          const tokens=normalizeTokens(await tokenRequest(app,{grant_type:'authorization_code',code,code_verifier:pending.verifier,redirect_uri:pending.redirectUri},this.remote));
          if(!await checkIdentity(tokens,this.remote))throw new SalesforceError('reconnect');
          tokens.checkedAt=new Date().toISOString();await this.save('tokens',tokens);return this.redirect('connected');
        } catch {return this.redirect('failed');}
      }
      if(['/api/admin/check','/api/admin/refresh','/api/admin/disconnect'].includes(url.pathname)&&request.method==='POST') {
        const app=await this.load<AppSettings>('app');let tokens=await this.load<TokenSet>('tokens');
        if(!app||!tokens)return json({error:'No Salesforce org is connected.'},409);
        if(url.pathname.endsWith('/disconnect')) {
          await revoke(app,tokens,this.remote);this.store.delete('tokens');this.store.delete('pending');return json({connected:false});
        }
        try {
          if(url.pathname.endsWith('/refresh')||!await checkIdentity(tokens,this.remote)) {
            tokens=normalizeTokens(await tokenRequest(app,{grant_type:'refresh_token',refresh_token:tokens.refreshToken},this.remote),tokens);
            // Persist rotated token before the next network call, so retries don't reuse an invalidated token.
            await this.save('tokens',tokens);
            if(!await checkIdentity(tokens,this.remote))throw new SalesforceError('reconnect');
          }
          tokens.checkedAt=new Date().toISOString();tokens.needsReconnect=false;await this.save('tokens',tokens);return json({connected:true,checkedAt:tokens.checkedAt});
        }catch(error){
          if(error instanceof SalesforceError&&error.kind==='reconnect'){tokens.needsReconnect=true;await this.save('tokens',tokens);}
          throw error;
        }
      }
      return json({error:'Not found or method not allowed.'},404);
    }catch(error){
      // Do not reflect upstream bodies, authorization codes, client secrets or tokens.
      if(error instanceof SalesforceError)return json({error:error.message},error.kind==='reconnect'?409:502);
      return json({error:'The request could not be completed. Check the settings and try again.'},400);
    }
  }
  private redirect(result:string) {return new Response(null,{status:303,headers:{Location:`${this.env.APP_ORIGIN}/connections?result=${result}`,'cache-control':'no-store','referrer-policy':'no-referrer'}});}
  private async load<T>(key:string):Promise<T|undefined>{const value=this.store.get<string>(key);return value?decrypt<T>(value,this.env.TOKEN_ENCRYPTION_KEY!):undefined;}
  private async save(key:string,value:unknown,expires?:number){this.store.put(key,await encrypt(value,this.env.TOKEN_ENCRYPTION_KEY!),expires);}
}
