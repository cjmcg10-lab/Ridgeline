// Coordinates and approximate resort elevations in metres.
const mountains = [
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
const zone = 'America/Denver';
const today = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dates = Array.from({length:16},(_,i)=>{
  const d=new Date(today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+i); return d.toISOString().slice(0,10);
});
async function forecast(m){
  const params=new URLSearchParams({latitude:[m[1],m[1]],longitude:[m[2],m[2]],elevation:m.slice(3),daily:fields,hourly:hourlyFields,timezone:zone,start_date:dates[0],end_date:dates.at(-1)});
  const res=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:AbortSignal.timeout(18000)});
  if(!res.ok) throw Error('Forecast unavailable');
  const data=await res.json();
  if(!Array.isArray(data)||data.length!==2) throw Error('Incomplete forecast');
  return data;
}
function rate([high,low,snow,rain,gust],day){
  const freshSnowBonus = Math.min(26, snow * 2);
  const windPenalty = Math.max(0, gust - 25) * 0.55;
  const temperaturePenalty = Math.max(0, high - 2) * 2 + Math.max(0, -15 - high) * 2;
  const thawPenalty = low < 0 && high > 3 && snow < 1 ? 8 : 0;
  const rawScore = 74 + freshSnowBonus - rain * 3 - windPenalty - temperaturePenalty - thawPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const rating = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Mixed' : 'Poor';
  const uncertainty=day>=5?2:day>=2?1:0;
  const confidence=day>=10?'Very low':['High','Medium','Low'][Math.min(2,uncertainty+Number(high>=-1 && high<=2 && rain+snow>0))];
  return {score,rating,confidence};
}
function showHours(hourly, date, day){
  const list = byId('hours');
  list.replaceChildren();
  (hourly?.time || []).forEach((time, index) => {
    if (time.slice(0,10) !== date) return;
    const row = document.createElement('li');
    const clock = document.createElement('strong');
    clock.textContent = time.slice(11,16);
    row.append(clock);
    const values = hourlyFields.map(field => hourly[field]?.[index]);
    if (values.every(Number.isFinite)) {
      const [temp,snow,rain,gust] = values;
      const {score,rating} = rate([temp,temp,snow,rain,gust],day);
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
      if(!values.every(Number.isFinite)){cell.textContent='Unavailable';return;}
      const {score,rating,confidence}=rate(values,i);
      const btn=document.createElement('button');btn.textContent=score+'/100';
      btn.className=rating.toLowerCase();
      const category=document.createElement('small');category.textContent=rating;btn.append(category);
      const small=document.createElement('small');small.textContent=confidence+' confidence';btn.append(small);
      btn.onclick=()=>{
        const dialog=byId('detail');dialog.querySelector('h2').textContent=m[0]+' · '+(l?'Summit':'Base');
        const [high,low,snow,rain,gust]=values;
        dialog.querySelector('p').textContent=date+' · '+score+'/100 · '+rating+' · '+confidence+' confidence. '+low+' to '+high+' °C, '+snow+' cm of snowfall, '+rain+' mm of rain and peak gusts of '+gust+' km/h.';showHours(data[l].hourly,date,i);dialog.showModal();dialog.scrollTop=0;
      };cell.append(btn);
    }));
  }));
  if(current!==generation || !selected.size)return;
  byId('status').textContent=failures?'Some forecasts could not load. ':'Select a daily score to explore its hourly forecast.';
  if(failures){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=render;byId('status').append(retry);}
}
for(const [name] of mountains){
  const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=selected.has(name);
  box.onchange=()=>{if(box.checked)selected.add(name);else selected.delete(name);
    const url=new URL(location.href);url.searchParams.set('mountains',[...selected].join(','));history.replaceState(null,'',url);render();};
  label.append(box,' '+name);byId('picker').append(label);
}
byId('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);byId('share').textContent='Link copied ✓';}catch{prompt('Copy your outlook link',location.href);}};
render();
