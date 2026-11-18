// Cloudflare Pages serves the static app and reads a fixed list of public resort reports.
const resorts = {
  Vail:'vail.com', Breckenridge:'breckenridge.com', Keystone:'keystoneresort.com',
  Stowe:'stowe.com', Okemo:'okemo.com', Attitash:'attitash.com',
  'Wildcat Mountain':'skiwildcat.com', 'Mount Sunapee':'mountsunapee.com'
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/surface') return env.ASSETS.fetch(request);
    const name = url.searchParams.get('mountain');
    if (!Object.hasOwn(resorts,name)) return Response.json(null);
    const source = 'https://www.' + resorts[name] + '/the-mountain/mountain-conditions/snow-and-weather-report.aspx';
    try {
      const response = await fetch(source,{cf:{cacheEverything:true,cacheTtl:900},signal:AbortSignal.timeout(6500)});
      if (!response.ok) throw Error();
      const html = await response.text();
      const match = html.match(/FR\.snowReportData\s*=\s*({[^;]+});/);
      const data = JSON.parse(match[1]);
      const timestamp = Date.parse(data.LastUpdatedText.replace(/^Updated /,'').replace(' at ',' '));
      if (!Number.isFinite(timestamp)) throw Error();
      return Response.json({source,timestamp,surface:String(data.OverallSnowConditions || '').trim()},{headers:{'Cache-Control':'public,max-age=900'}});
    } catch {
      return Response.json(null,{status:503});
    }
  }
};
