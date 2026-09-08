import type { SalesforceEnvironment } from './client-credentials';
type ActivityTemplate = typeof import('../../jb-activity/config.json');
type WorkerBindings = Pick<Env, "ASSETS"> & Partial<Pick<Env,"CONNECTIONS">> & { APPLICATION_EXTENSION_KEY?: string } & SalesforceEnvironment;
export default {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/connections' || url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/oauth/')) {
      return new Response('Interactive authorization has been removed. Salesforce uses server-side client credentials.', {status:410,headers:{'cache-control':'no-store','content-type':'text/plain','set-cookie':'__Host-jah-admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
    }
    if (url.pathname === '/config.json') {
      if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
      const templateResponse = await env.ASSETS.fetch(new Request(new URL('/config.json', url), {method:'GET'}));
      if (!templateResponse.ok) return new Response('Configuration template unavailable', {status:503});
      const config = await templateResponse.json() as ActivityTemplate;
      config.arguments.execute.url = `${url.origin}/activity/execute`;
      for (const action of ['save','publish','validate','stop','unpublish'] as const) config.configurationArguments[action].url = `${url.origin}/activity/${action}`;
      config.configurationArguments.applicationExtensionKey = env.APPLICATION_EXTENSION_KEY || config.configurationArguments.applicationExtensionKey;
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(config), {headers:{'content-type':'application/json','cache-control':'no-store'}});
    }
    if (url.pathname === '/health') return Response.json({status:'ok',phase:3,runtimeEnabled:false,packageConfigured:!!env.APPLICATION_EXTENSION_KEY,salesforceConfigured:!!(env.SF_CLIENT_ID && env.SF_CLIENT_SECRET && env.SF_LOGIN_URL),authMethod:'client_credentials'});
    if (url.pathname.startsWith('/activity/')) {
      if (request.method !== 'POST') return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
      const action = url.pathname.slice('/activity/'.length);
      if (['save','stop','unpublish'].includes(action)) return new Response('OK');
      if (['publish','validate'].includes(action)) return Response.json({error:'Runtime is disabled. Runtime authentication and executors must be implemented before activation.'},{status:422});
      if (action === 'execute') return Response.json({status:'not-implemented',message:'Flow execution is not implemented yet.'},{status:501});
      return new Response('Not found',{status:404});
    }
    return env.ASSETS.fetch(request);
  }
};
