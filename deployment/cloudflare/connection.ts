import { DurableObject } from 'cloudflare:workers';
import { SalesforceClient, type SalesforceEnvironment } from './client-credentials';
/** Internal-only Salesforce API client; no admin UI, cookie sessions or OAuth callbacks. */
export class SalesforceConnection extends DurableObject<Env & SalesforceEnvironment> {
  private client: SalesforceClient;
  constructor(ctx: DurableObjectState, env: Env & SalesforceEnvironment) {
    super(ctx, env);
    this.client = new SalesforceClient(env);
    // Historical encrypted authorization-code records are retained but never read or used.
  }
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    return this.client.request(path, init);
  }
}
