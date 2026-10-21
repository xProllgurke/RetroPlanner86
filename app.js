let session=null,cloudState={},busy=false;
const names=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const morningWeek=['06:30 Uhr aufstehen','Bett machen','Lüften','Zähne putzen','Anziehen','Ab 07:00 Uhr Medikamente','Frühstücken','08:00 Uhr Umschulung'];
const eveningWeek=[['Abendessen','Duschen','Danach freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen','Spätestens um 23:00 Uhr ins Bett'],['Abendessen','Freizeit / freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen','Spätestens um 23:00 Uhr ins Bett'],['Abendessen','Duschen + Hygieneroutine','Danach freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen','Spätestens um 23:00 Uhr ins Bett'],['Abendessen','Freizeit / freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen','Spätestens um 23:00 Uhr ins Bett'],['Abendessen','Duschen','Danach freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen','Spätestens um 23:00 Uhr ins Bett']];
const middleWeek=[['Blockpausen: Lernen oder Freizeit (frei wählbar)','Aufräumen','Wäsche waschen'],['Blockpausen: Lernen oder Freizeit (frei wählbar)','Einkaufen','Einkauf ausräumen (zusammen)'],['Blockpausen: Lernen oder Freizeit (frei wählbar)','Kochen + aufräumen','GYM'],['Blockpausen: Lernen oder Freizeit (frei wählbar)','Staub wischen','Fegen / saugen','Oberflächen reinigen'],['Blockpausen: Lernen oder Freizeit (frei wählbar)','Wäsche waschen','GYM']];
const morningEnd=['Spätestens 09:00 Uhr aufstehen','Bett machen','Lüften','Zähne putzen','Anziehen','Medikamente nach dem Aufstehen','Frühstücken'];
const data=names.map((_,i)=>i<5?{MORGENS:morningWeek,MITTAGS:middleWeek[i],ABENDS:eveningWeek[i]}:{MORGENS:morningEnd,MITTAGS:i===5?['Staub wischen, fegen, wischen + Oberflächen reinigen (zusammen)','Kochen freestylen + aufräumen (zusammen)','Freizeit / freie Gestaltung']:['Müll + Mülltonne','Aufräumen nach Ennas Kochen','Spiegel reinigen','Finanztalk','Am 1. Sonntag im Monat: Schränke + Unterlagen sortieren','Freizeit / freie Gestaltung'],ABENDS:i===5?['Abendessen','Freizeit / freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen']:['Abendessen','Duschen + Haare waschen / Hygieneroutine','Danach freie Gestaltung','21:30 Uhr Medikamente','Zähne putzen']});
let day=(()=>{const d=period();const [y,m,dd]=d.split('-').map(Number);return (new Date(Date.UTC(y,m-1,dd)).getUTCDay()+6)%7})();
let group=day<5?'weekday':'weekend';
function berlinNow(){let parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return parts;}
function period(){const p=berlinNow();let date=new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);if(Number(p.hour)<6||(Number(p.hour)===6&&Number(p.minute)<30))date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10)}
function selectedDate(){
  const [y,m,d]=period().split('-').map(Number);
  const base=new Date(Date.UTC(y,m-1,d,12));
  const weekday=(base.getUTCDay()+6)%7;
  base.setUTCDate(base.getUTCDate()-weekday+day);
  return base.toISOString().slice(0,10);
}
function key(){return 'retro86:v2:'+selectedDate()}
function read(){return cloudState[selectedDate()]||{}}
function chooseGroup(g){group=g;if(g==='weekday'&&day>4)day=0;if(g==='weekend'&&day<5)day=5;render();loadChecks()}
function chooseDay(i){day=i;group=i<5?'weekday':'weekend';render();loadChecks()}
async function toggle(id,val){
 if(!session){status('Bitte zuerst anmelden.',true);render();return}
 const date=selectedDate(), task_id=rainId(id);if(!task_id){status('Ungültige Aufgabe',true);return}
 const old={...(cloudState[date]||{})};cloudState[date]={...old,[id]:val};render();
 try{await api('/rest/v1/planner_checks?on_conflict=user_id,plan_date,task_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.user.id,plan_date:date,task_id,checked:val})});status('Synchronisiert ✓')}
 catch(e){cloudState[date]=old;render();status('Speichern fehlgeschlagen: '+e.message,true)}
}
async function resetCurrent(){
 if(!session){status('Bitte zuerst anmelden.',true);return}
 if(!confirm('Alle Häkchen für '+names[day]+' zurücksetzen?'))return;
 const date=selectedDate(),old=cloudState[date]||{};cloudState[date]={};render();
 try{await api('/rest/v1/planner_checks?user_id=eq.'+encodeURIComponent(session.user.id)+'&plan_date=eq.'+date,{method:'DELETE'});status('Tag zurückgesetzt ✓')}
 catch(e){cloudState[date]=old;render();status('Reset fehlgeschlagen: '+e.message,true)}
}
function progress(){const s=read(),total=Object.values(data[day]).reduce((n,arr)=>n+arr.length,0),done=Object.values(s).filter(Boolean).length;document.getElementById('count').textContent=`${done} / ${total}`;document.getElementById('bar').style.width=(done/total*100)+'%'}
function render(){document.getElementById('date').textContent=names[day]+' · '+selectedDate().split('-').reverse().join('.');for(const g of ['weekday','weekend'])document.getElementById(g).classList.toggle('active',g===group);const nav=document.getElementById('days');nav.replaceChildren();names.forEach((name,i)=>{if((i<5)!==(group==='weekday'))return;let b=document.createElement('button');b.textContent=name;b.className=day===i?'active':'';b.onclick=()=>chooseDay(i);nav.append(b)});const main=document.getElementById('tasks');main.replaceChildren();let s=read();Object.entries(data[day]).forEach(([period,items])=>{let section=document.createElement('section'),heading=document.createElement('h2');heading.textContent=period;section.append(heading);items.forEach((t,i)=>{const id=period+':'+i,lab=document.createElement('label'),check=document.createElement('input'),span=document.createElement('span');lab.className='task';check.type='checkbox';check.checked=!!s[id];check.onchange=()=>toggle(id,check.checked);span.textContent=t;lab.append(check,span);section.append(lab)});main.append(section)});progress()}
let last=period();setInterval(()=>{if(period()!==last){last=period();render();loadChecks()}},15000);render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// CLOUD SYNC – ausschließlich Publishable Key im Browser, keine geheimen Schlüssel.
const SUPABASE_URL='https://dmhcsokedvtstfragzam.supabase.co';
const SUPABASE_KEY='sb_publishable_rT-dkyMu4WPT_nucFCP04Q_5KY8bLAU';
function status(msg,error=false){const el=document.getElementById('syncStatus');if(el){el.textContent=msg;el.style.color=error?'#ff8b96':'#00e5ff'}}
function rainId(id){const [part,index]=id.split(':');const partOffset=part==='MORGENS'?0:part==='MITTAGS'?data[day].MORGENS.length:data[day].MORGENS.length+data[day].MITTAGS.length;return (day+1)+'_'+(partOffset+Number(index)+1)}
function fromRainId(task){const parts=task.split('_');const n=Number(parts[1])-1,dayIndex=Number(parts[0])-1;if(dayIndex!==day)return null;const m=data[dayIndex].MORGENS.length,mid=data[dayIndex].MITTAGS.length;return n<m?'MORGENS:'+n:n<m+mid?'MITTAGS:'+(n-m):'ABENDS:'+(n-m-mid)}
async function api(path,options={}){
 if(!session?.access_token)throw Error('Nicht angemeldet');
 const headers={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+session.access_token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})};
 let res=await fetch(SUPABASE_URL+path,{...options,headers});if(res.status===401&&session.refresh_token){await refreshSession();headers.Authorization='Bearer '+session.access_token;res=await fetch(SUPABASE_URL+path,{...options,headers})}
 if(!res.ok)throw Error('HTTP '+res.status+' '+(await res.text()).slice(0,140));const body=await res.text();return body?JSON.parse(body):null;
}
async function authRequest(path,body){const res=await fetch(SUPABASE_URL+'/auth/v1/'+path,{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.msg||json.error_description||json.message||'Anmeldung fehlgeschlagen');return json}
async function refreshSession(){if(!session?.refresh_token)throw Error('Erneut anmelden');const s=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});setSession(s)}
function setSession(s){session=s;sessionStorage.setItem('retro86_session',JSON.stringify(s));document.getElementById('authForm').hidden=true;document.getElementById('logout').hidden=false;document.getElementById('planner').hidden=false;status('Angemeldet – synchronisiere …')}
async function login(event){event.preventDefault();status('Anmeldung läuft …');try{const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;const s=await authRequest('token?grant_type=password',{email,password});setSession(s);document.getElementById('password').value='';await loadChecks()}catch(e){status(e.message,true)}}
function logout(){session=null;cloudState={};sessionStorage.removeItem('retro86_session');document.getElementById('authForm').hidden=false;document.getElementById('logout').hidden=true;document.getElementById('planner').hidden=true;status('Abgemeldet')}
async function loadChecks(){if(!session||busy)return;busy=true;const date=selectedDate(),currentDay=day;try{const rows=await api('/rest/v1/planner_checks?select=task_id,checked&user_id=eq.'+encodeURIComponent(session.user.id)+'&plan_date=eq.'+date);if(date!==selectedDate()||currentDay!==day)return;const state={};for(const row of rows){const id=fromRainId(row.task_id);if(id)state[id]=row.checked}cloudState[date]=state;render();status('Cloud synchronisiert ✓')}catch(e){status('Cloud nicht erreichbar: '+e.message,true)}finally{busy=false}}
(async()=>{try{const s=JSON.parse(sessionStorage.getItem('retro86_session')||'null');if(s?.refresh_token){session=s;await refreshSession();await loadChecks()}}catch(e){logout()}})();
setInterval(()=>{if(session)loadChecks()},20000);
