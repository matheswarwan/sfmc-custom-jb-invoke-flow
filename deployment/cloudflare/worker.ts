type ActivityTemplate = typeof import('../../jb-activity/config.json');
interface Env { ASSETS: { fetch(request: Request): Promise<Response> }; APPLICATION_EXTENSION_KEY?: string }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
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
    if (url.pathname === '/health') return Response.json({status:'ok',phase:2,runtimeEnabled:false,packageConfigured:!!env.APPLICATION_EXTENSION_KEY});
    if (url.pathname.startsWith('/activity/')) {
      if (request.method !== 'POST') return new Response('Method not allowed',{status:405,headers:{Allow:'POST'}});
      const action = url.pathname.slice('/activity/'.length);
      if (['save','stop','unpublish'].includes(action)) return new Response('OK');
      if (['publish','validate'].includes(action)) return Response.json({error:'Phase 2 is configuration-only. Runtime authentication and executors must be implemented before activation.'},{status:422});
      if (action === 'execute') return Response.json({status:'not-implemented',message:'Salesforce OAuth and Flow execution are not implemented in Phase 2.'},{status:501});
      return new Response('Not found',{status:404});
    }
    return env.ASSETS.fetch(request);
  }
};
