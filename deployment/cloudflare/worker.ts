type ActivityTemplate = typeof import('../../jb-activity/config.json');
type WorkerBindings = Pick<Env, "ASSETS"> & Partial<Pick<Env,"CONNECTIONS">> & { APPLICATION_EXTENSION_KEY?: string };
export default {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/oauth/')) {
      if (!env.CONNECTIONS) return Response.json({error:'Connection storage is not configured.'},{status:503});
      return env.CONNECTIONS.getByName('sf-prod').handle(request);
    }
    if (url.pathname === '/connections') {
      const response = await env.ASSETS.fetch(new Request(new URL('/index.html',url)));
      const headers = new Headers(response.headers); headers.set('cache-control','no-store'); headers.set('x-frame-options','DENY'); headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'"); headers.set('referrer-policy','no-referrer');
      return new Response(response.body,{status:response.status,headers});
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
    if (url.pathname === '/health') return Response.json({status:'ok',phase:3,runtimeEnabled:false,packageConfigured:!!env.APPLICATION_EXTENSION_KEY});
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
