// Coordinates and approximate resort elevations in metres.
const mountains = [
  ['Killington',43.63,-72.80,355,1293,'VT'],
  ['Stowe',44.53,-72.78,390,1108,'VT'],
  ['Sugarloaf',45.03,-70.31,432,1291,'ME'],
  ['Jay Peak',44.94,-72.51,553,1209,'VT'],
  ['Sugarbush',44.14,-72.89,451,1244,'VT'],
  ['Okemo',43.40,-72.72,348,1019,'VT'],
  ['Stratton',43.11,-72.91,571,1180,'VT'],
  ['Mount Snow',42.96,-72.92,579,1097,'VT'],
  ["Smugglers’ Notch",44.59,-72.79,314,1109,'VT'],
  ['Mad River Glen',44.20,-72.92,488,1109,'VT'],
  ['Bolton Valley',44.42,-72.85,440,960,'VT'],
  ['Bromley',43.21,-72.94,594,1000,'VT'],
  ['Cannon Mountain',44.16,-71.70,579,1244,'NH'],
  ['Loon Mountain',44.04,-71.63,290,930,'NH'],
  ['Bretton Woods',44.26,-71.44,488,945,'NH'],
  ['Wildcat Mountain',44.26,-71.24,594,1238,'NH'],
  ['Attitash',44.08,-71.23,183,716,'NH'],
  ['Waterville Valley',43.95,-71.50,604,1220,'NH'],
  ['Mount Sunapee',43.33,-72.08,375,836,'NH'],
  ['Sunday River',44.47,-70.86,244,959,'ME'],
  ['Saddleback',44.95,-70.53,750,1256,'ME'],
  ['Whiteface',44.35,-73.86,372,1338,'NY'],
  ['Gore Mountain',43.67,-74.01,305,1097,'NY'],
  ['Belleayre',42.14,-74.50,617,1044,'NY'],
  ['Hunter Mountain',42.20,-74.23,488,975,'NY'],
  ['Holiday Valley',42.26,-78.67,457,686,'NY'],
  ['Jiminy Peak',42.56,-73.29,381,724,'MA'],
  ['Wachusett Mountain',42.50,-71.89,305,611,'MA'],
  ['Blue Mountain',40.81,-75.52,140,470,'PA'],
  ['Elk Mountain',41.72,-75.56,516,821,'PA'],
  ['Pico Mountain',43.66,-72.84,610,1209,'VT'],
  ['Magic Mountain',43.20,-72.77,411,869,'VT'],
  ['Burke Mountain',44.59,-71.92,369,996,'VT'],
  ['Middlebury Snowbowl',43.94,-72.96,561,975,'VT'],
  ['Saskadena Six',43.67,-72.54,168,366,'VT'],
  ['Pats Peak',43.16,-71.80,210,445,'NH'],
  ['Gunstock',43.54,-71.37,274,692,'NH'],
  ['Cranmore',44.06,-71.11,161,610,'NH'],
  ['Ragged Mountain',43.49,-71.84,305,686,'NH'],
  ['Black Mountain of New Hampshire',44.17,-71.16,381,716,'NH'],
  ['King Pine',43.87,-71.09,152,259,'NH'],
  ['Pleasant Mountain',44.06,-70.82,107,579,'ME'],
  ['Black Mountain of Maine',44.58,-70.61,305,727,'ME'],
  ['Mt Abram',44.38,-70.71,317,610,'ME'],
  ['Camden Snow Bowl',44.22,-69.13,70,326,'ME'],
  ['Bristol Mountain',42.75,-77.40,183,671,'NY'],
  ['Greek Peak',42.51,-76.14,350,640,'NY'],
  ['Plattekill Mountain',42.29,-74.65,732,1067,'NY'],
  ['Catamount',42.17,-73.48,280,610,'NY'],
  ['West Mountain',43.29,-73.73,133,448,'NY'],
  ['Titus Mountain',44.73,-74.23,411,617,'NY'],
  ['Berkshire East',42.62,-72.88,189,560,'MA'],
  ['Ski Butternut',42.18,-73.32,244,549,'MA'],
  ['Bousquet Mountain',42.42,-73.28,299,570,'MA'],
  ['Camelback Mountain',41.05,-75.36,381,650,'PA'],
  ['Montage Mountain',41.35,-75.66,293,597,'PA'],
  ['Seven Springs',40.02,-79.30,683,914,'PA'],
  ['Blue Knob',40.30,-78.56,631,960,'PA'],
  ['Mohawk Mountain',41.84,-73.31,290,488,'CT'],
  ['Ski Sundown',41.88,-72.95,137,328,'CT'],
  ['Vail',39.64,-106.37,2475,3527],['Breckenridge',39.48,-106.07,2926,3962],
  ['Copper Mountain',39.50,-106.15,2960,3753],['Keystone',39.60,-105.95,2829,3782],
  ['Winter Park',39.88,-105.76,2743,3676],['Steamboat',40.46,-106.80,2103,3221]
];
const byId = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('mountains');
const selected = new Set(mountains.map(m=>m[0]).filter((name,i)=>requested===null ? i<3 : requested.split(',').includes(name)));
const fields = ['temperature_2m_max','temperature_2m_min','snowfall_sum','rain_sum','wind_gusts_10m_max'];
const hourlyFields = ['temperature_2m','snowfall','rain','wind_gusts_10m'];
const cache = new Map();
const zone = 'America/New_York';
const today = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dates = Array.from({length:16},(_,i)=>{
  const d=new Date(today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+i); return d.toISOString().slice(0,10);
});
async function forecast(m){
  const start=new Date(dates[0]+"T12:00:00Z");
  start.setUTCDate(start.getUTCDate()-15);
  const params=new URLSearchParams({latitude:[m[1],m[1]],longitude:[m[2],m[2]],elevation:m.slice(3,5),daily:fields,hourly:[...hourlyFields,"visibility"],timezone:m[5]?zone:'America/Denver',start_date:start.toISOString().slice(0,10),end_date:dates.at(-1)});
  const res=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:AbortSignal.timeout(18000)});
  if(!res.ok) throw Error('Forecast unavailable');
  const data=await res.json();
  if(!Array.isArray(data)||data.length!==2) throw Error('Incomplete forecast');
  return data.map(elevation=>({...elevation, quality:scoreTimeline(elevation.hourly)}));
}
function category(score){
  return score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Mixed' : 'Poor';
}
function scoreTimeline(hourly){
  const hours=[];
  const skiDays=new Map();
  let softSnow=0, wetness=0, crust=0, validHours=0;
  for(const [i,time] of (hourly?.time || []).entries()){
    const [temp,snow,rain,gust]=hourlyFields.map(field=>hourly[field]?.[i]);
    if(![temp,snow,rain,gust].every(Number.isFinite)){
      softSnow=wetness=crust=validHours=0;
      continue;
    }
    // Recent snow settles over days. Wet surfaces refreeze and retain crust
    // until it weathers away or is buried by accumulating new snow.
    const thaw=Math.max(0,temp);
    // A surface-softness proxy in cm, not total snow depth. Warm or windy
    // hours shorten the useful lifetime of loose snow at this elevation.
    const settling=0.007 + Math.min(0.015,thaw*0.002)
      + Math.min(0.018,Math.max(0,gust-35)*0.0004);
    softSnow=Math.max(0,softSnow*(1-settling) + snow - thaw*0.09 - rain*0.6);
    wetness=Math.min(15,wetness*0.97 + rain + thaw*0.16);
    const freeze=temp<0 ? wetness*Math.min(0.5,-temp*0.05) : 0;
    wetness-=freeze;
    crust=Math.max(0,Math.min(20,crust*0.997 + freeze - thaw*0.12));
    validHours++;
    if(validHours<=14*24) continue;
    const visibility=hourly.visibility?.[i];
    if(!Number.isFinite(visibility)) continue;
    // Starting values for recreational piste skiing. Coverage is assumed on open runs.
    const clamp=value=>Math.max(0,Math.min(1,value));
    const iceFraction=clamp(crust/8);
    const firmBase=85-65*iceFraction;
    const softened=firmBase+(85-firmBase)*clamp(wetness/3);
    const slush=clamp((wetness-3)/9);
    const underlying=softened*(1-slush)+40*slush;
    const freshFraction=1-Math.exp(-softSnow/6);
    const surface=underlying*(1-freshFraction)+(95-55*slush)*freshFraction;
    const weather=100-40*clamp((gust-25)/50)-40*clamp((2000-visibility)/1800)-20*clamp(rain/3);
    hours[i]=Math.round(0.8*surface+0.2*weather);
    const hour=Number(time.slice(11,13));
    if(hour>=9 && hour<16){
      const date=time.slice(0,10);
      if(!skiDays.has(date)) skiDays.set(date,[]);
      skiDays.get(date).push(hours[i]);
    }
  }
  const days=new Map();
  const windows=new Map();
  for(const [date,scores] of skiDays){
    if(scores.length!==7) continue;
    let best=0;
    for(let i=1;i<=4;i++){
      if(scores[i]+scores[i+1]+scores[i+2]>scores[best]+scores[best+1]+scores[best+2]) best=i;
    }
    windows.set(date,(9+best)+":00–"+(12+best)+":00");
    days.set(date,Math.round(scores.reduce((a,b)=>a+b,0)/7));
  }
  return {hours,days,windows};
}
function dayConfidence([high,low,snow,rain],day){
  const uncertainty=day>=5?2:1;
  const confidence=day>=10?'Very low':['High','Medium','Low'][Math.min(2,uncertainty+Number(high>=-1 && high<=2 && rain+snow>0))];
  return confidence;
}
function showHours(hourly, date, scores){
  const list = byId('hours');
  list.replaceChildren();
  (hourly?.time || []).forEach((time, index) => {
    if (time.slice(0,10) !== date) return;
    const row = document.createElement('li');
    const clock = document.createElement('strong');
    clock.textContent = time.slice(11,16);
    row.append(clock);
    const values = hourlyFields.map(field => hourly[field]?.[index]);
    if (Number.isFinite(scores[index])) {
      const [temp,snow,rain,gust] = values;
      const score=scores[index], rating=category(score);
      const badge = document.createElement('span');
      badge.className = rating.toLowerCase();
      badge.textContent = score + '/100 · ' + rating;
      const weather = document.createElement('small');
      weather.textContent = temp + ' °C · Snow ' + snow + ' cm · Rain ' + rain + ' mm · Gusts ' + gust + ' km/h';
      row.append(badge,weather);
    } else {
      row.append('Unavailable');
    }
    list.append(row);
  });
  if (!list.children.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Hourly forecast unavailable for this day.';
    list.append(empty);
  }
}
let generation=0;
async function render(){
  const current=++generation;
  const table=document.createElement('table');
  const head=table.createTHead().insertRow();
  for(const label of ['Mountain',...dates.map(d=>new Date(d+'T12:00Z').toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}))]){
    const th=document.createElement('th');th.textContent=label;head.append(th);
  }
  const body=table.createTBody();byId('grid').replaceChildren(table);
  byId('status').textContent=selected.size?'Loading forecasts…':'Choose a mountain to see its forecast.';
  let failures=0;
  await Promise.all(mountains.filter(m=>selected.has(m[0])).map(async m=>{
    const rows=['Base','Summit'].map((level,l)=>{
      const row=body.insertRow();const th=document.createElement('th');th.textContent=m[0];
      const small=document.createElement('small');small.textContent=level+' · '+m[3+l].toLocaleString()+' m';th.append(small);row.append(th);return row;
    });
    let data;
    try{
      if(!cache.has(m[0])) cache.set(m[0],forecast(m));
      data=await cache.get(m[0]);
    }catch{cache.delete(m[0]);failures++;}
    rows.forEach((row,l)=>dates.forEach((date,i)=>{
      const cell=row.insertCell(), daily=data?.[l]?.daily;
      const index=daily?.time?.indexOf(date);
      const values=fields.map(f=>daily?.[f]?.[index]);
      const score=data?.[l]?.quality.days.get(date);
      if(!Number.isFinite(score) || !values.every(Number.isFinite)){cell.textContent='Unavailable';return;}
      const rating=category(score), confidence=dayConfidence(values,i);
      const btn=document.createElement('button');btn.textContent=score+'/100';
      btn.className=rating.toLowerCase();
      const label=document.createElement('small');label.textContent=rating;btn.append(label);
      const small=document.createElement('small');small.textContent=confidence+' confidence';btn.append(small);
      btn.onclick=()=>{
        const dialog=byId('detail');dialog.querySelector('h2').textContent=m[0]+' · '+(l?'Summit':'Base');
        const [high,low,snow,rain,gust]=values;
        dialog.querySelector('p').textContent=date+' · '+score+'/100 · '+rating+' · '+confidence+' confidence. '+low+' to '+high+' °C, '+snow+' cm of snowfall, '+rain+' mm of rain and peak gusts of '+gust+' km/h. Each hour uses at least 14 days of modeled snow history at this elevation. This daily score averages the seven scores from 9 am through 3 pm local time. Best three-hour window: '+data[l].quality.windows.get(date)+' local time.';dialog.querySelector('h3').textContent='Hourly outlook · '+(m[5]?'Eastern':'Mountain')+' time';showHours(data[l].hourly,date,data[l].quality.hours);dialog.showModal();dialog.scrollTop=0;
      };cell.append(btn);
    }));
  }));
  if(current!==generation || !selected.size)return;
  byId('status').textContent=failures?'Some forecasts could not load. ':'Select a daily score to explore its hourly forecast.';
  if(failures){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=render;byId('status').append(retry);}
}
const states={VT:'Vermont',ME:'Maine',NH:'New Hampshire',NY:'New York',MA:'Massachusetts',PA:'Pennsylvania',CT:'Connecticut',CO:'Colorado'};
const picker=byId('picker');
const summary=picker.parentElement.querySelector('summary');
function updateCount(){
  summary.textContent='Compare mountains ('+selected.size+')';
}
for(const [code,state] of Object.entries(states)){
  const group=document.createElement('details');
  const heading=document.createElement('summary');
  heading.textContent=state;
  group.append(heading);
  const resorts=mountains.filter(m=>(m[5] || 'CO')===code)
    .sort((a,b)=>a[0].localeCompare(b[0]));
  for(const [name] of resorts){
    const label=document.createElement('label');
    const box=document.createElement('input');
    box.type='checkbox';
    box.checked=selected.has(name);
    box.onchange=()=>{
      if(box.checked) selected.add(name);
      else selected.delete(name);
      const url=new URL(location.href);
      url.searchParams.set('mountains',[...selected].join(','));
      history.replaceState(null,'',url);
      updateCount();
      render();
    };
    label.append(box,' '+name);
    group.append(label);
  }
  picker.append(group);
}
updateCount();
byId('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);byId('share').textContent='Link copied ✓';}catch{prompt('Copy your outlook link',location.href);}};
render();
