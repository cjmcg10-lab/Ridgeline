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
  start.setUTCDate(start.getUTCDate()-14);
  const params=new URLSearchParams({latitude:[m[1],m[1]],longitude:[m[2],m[2]],elevation:m.slice(3,5),daily:fields,hourly:[...hourlyFields,"snow_depth"],timezone:m[5]?zone:'America/Denver',start_date:start.toISOString().slice(0,10),end_date:dates.at(-1)});
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
    softSnow=Math.max(0, softSnow*0.993 + snow - thaw*0.09 - rain*0.6);
    wetness=Math.min(15,wetness*0.97 + rain + thaw*0.16);
    const freeze=temp<0 ? wetness*Math.min(0.5,-temp*0.05) : 0;
    wetness-=freeze;
    crust=Math.max(0,Math.min(20,crust*0.997 + freeze - snow*0.55 - thaw*0.03));
    validHours++;
    if(validHours<49) continue;
    const depth=hourly.snow_depth?.[i]; // Open-Meteo reports metres of modeled natural snow.
    const thinCover=Number.isFinite(depth) ? 28*Math.max(0,1-depth/0.30) : 0;
    const surface=70 + Math.min(30,softSnow*1.3) - wetness - crust*1.8 - thinCover;
    const weather=rain*3 + Math.max(0,gust-25)*0.55 + Math.max(0,temp-2)*2 + Math.max(0,-15-temp)*2;
    hours[i]=Math.max(0,Math.min(100,Math.round(surface-weather)));
    const hour=Number(time.slice(11,13));
    if(hour>=9 && hour<16){
      const date=time.slice(0,10);
      if(!skiDays.has(date)) skiDays.set(date,[]);
      skiDays.get(date).push(hours[i]);
    }
  }
  const days=new Map();
  for(const [date,scores] of skiDays){
    if(scores.length===7) days.set(date,Math.round(scores.reduce((a,b)=>a+b,0)/7));
  }
  return {hours,days};
}
function dayConfidence([high,low,snow,rain],day){
  const uncertainty=day>=5?2:day>=2?1:0;
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
      const category=document.createElement('small');category.textContent=rating;btn.append(category);
      const small=document.createElement('small');small.textContent=confidence+' confidence';btn.append(small);
      btn.onclick=()=>{
        const dialog=byId('detail');dialog.querySelector('h2').textContent=m[0]+' · '+(l?'Summit':'Base');
        const [high,low,snow,rain,gust]=values;
        dialog.querySelector('p').textContent=date+' · '+score+'/100 · '+rating+' · '+confidence+' confidence. '+low+' to '+high+' °C, '+snow+' cm of snowfall, '+rain+' mm of rain and peak gusts of '+gust+' km/h. Daily score averages 9 am through 3 pm local hourly scores, including recent snowfall, thaw and refreezing.';dialog.querySelector('h3').textContent='Hourly outlook · '+(m[5]?'Eastern':'Mountain')+' time';showHours(data[l].hourly,date,data[l].quality.hours);dialog.showModal();dialog.scrollTop=0;
      };cell.append(btn);
    }));
  }));
  if(current!==generation || !selected.size)return;
  byId('status').textContent=failures?'Some forecasts could not load. ':'Select a daily score to explore its hourly forecast.';
  if(failures){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=render;byId('status').append(retry);}
}
const states={VT:'Vermont',ME:'Maine',NH:'New Hampshire',NY:'New York',MA:'Massachusetts',PA:'Pennsylvania',CO:'Colorado'};
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
