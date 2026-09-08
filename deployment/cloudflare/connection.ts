import { DurableObject } from 'cloudflare:workers';
import { ConnectionService, type Store } from './oauth/service';
export interface PrivateSecrets { ADMIN_ACCESS_KEY?:string; TOKEN_ENCRYPTION_KEY?:string }
export class SalesforceConnection extends DurableObject<Env & PrivateSecrets> {
  private service:ConnectionService;
  constructor(ctx:DurableObjectState,env:Env & PrivateSecrets) {
    super(ctx,env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER)');
    const store:Store={
      get:<T>(key:string)=>{const row=ctx.storage.sql.exec<{value:string;expires:number|null}>('SELECT value,expires FROM entries WHERE key=?',key).toArray()[0];if(!row)return undefined;if(row.expires&&row.expires<Date.now()){ctx.storage.sql.exec('DELETE FROM entries WHERE key=?',key);return undefined;}return JSON.parse(row.value) as T;},
      put:(key,value,expires)=>{ctx.storage.sql.exec('DELETE FROM entries WHERE expires IS NOT NULL AND expires < ?',Date.now());ctx.storage.sql.exec('INSERT OR REPLACE INTO entries (key,value,expires) VALUES (?,?,?)',key,JSON.stringify(value),expires??null);},
      delete:key=>{ctx.storage.sql.exec('DELETE FROM entries WHERE key=?',key);}
    };
    this.service=new ConnectionService(store,env);
  }
  async handle(request:Request):Promise<Response>{return this.service.handle(request);}
}
