/* app.js — split JS for GoalPro demo (English) */
/* ---------- Utilities ---------- */
const UID = (prefix='id') => (prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6));
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const toast = (msg, timeout=3500, actionText=null, action=null) => {
  const sb = $('#snackbar');
  sb.textContent = msg;
  sb.classList.add('show');
  if(actionText){
    const btn = document.createElement('button');
    btn.textContent = actionText; btn.style.marginLeft='8px'; btn.className='btn';
    btn.onclick = () => { action && action(); sb.classList.remove('show'); };
    sb.appendChild(btn);
  }
  clearTimeout(sb._t);
  sb._t = setTimeout(()=>sb.classList.remove('show'), timeout);
};

/* ---------- Storage Layer (safe) ---------- */
const STORAGE_KEY = 'gp:data:v1';
const TEMP_KEY = STORAGE_KEY + ':tmp';
const DEFAULT = () => ({
  version: 1,
  createdAt: new Date().toISOString(),
  categories: [
    {id:'cat_work', name:'Work', color:'#06b6d4'},
    {id:'cat_fin', name:'Finance', color:'#34d399'},
    {id:'cat_health', name:'Health', color:'#f97316'},
    {id:'cat_personal', name:'Personal', color:'#7c3aed'}
  ],
  goals: []
});
const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return DEFAULT();
    const parsed = JSON.parse(raw);
    if(!parsed.version) throw new Error('Invalid schema');
    return parsed;
  } catch(e){
    console.error('loadData error', e);
    toast('Error reading data. Please export your data and try again.', 6000);
    return DEFAULT();
  }
};
const saveDataAtomic = (data) => {
  try{
    const s = JSON.stringify(data);
    localStorage.setItem(TEMP_KEY, s);
    localStorage.setItem(STORAGE_KEY, localStorage.getItem(TEMP_KEY));
    localStorage.removeItem(TEMP_KEY);
  }catch(e){
    console.error('save error', e);
    if(e.name === 'QuotaExceededError'){
      toast('localStorage quota exceeded. Please export and clear some data.', 8000);
    } else {
      toast('Error saving data. Check console.', 4000);
    }
  }
};

/* ---------- App State ---------- */
let state = loadData();
let filter = { q:'', categoryId: null, tab:'all' };
let dirty = false;
let saveTimer = null;

const scheduleSave = (immediate=false) => {
  dirty = true;
  if(immediate){
    saveDataAtomic(state);
    dirty = false;
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    saveDataAtomic(state);
    dirty=false;
    $('#sub-info').textContent = `Saved @ ${new Date().toLocaleTimeString()}`;
  }, 700);
};

/* ---------- Sync across tabs ---------- */
window.addEventListener('storage', (e) => {
  if(e.key === STORAGE_KEY && e.newValue){
    try{
      const remote = JSON.parse(e.newValue);
      if(new Date(remote.createdAt) > new Date(state.createdAt)){
        state = remote;
        renderAll();
        toast('Data synchronized from another tab', 2000);
      }
    }catch(err){console.warn('invalid remote data', err);}
  }
});

/* ---------- DOM Helpers ---------- */
const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : '--';
const percent = (done, total) => total? Math.round((done/total)*100) : 0;

/* ---------- Core CRUD ---------- */
function createCategory(name, color='#cbd5e1'){
  const id = UID('cat');
  state.categories.push({id, name, color});
  scheduleSave();
  renderCategories();
  return id;
}
function createGoal(payload){
  const id = UID('g');
  const goal = Object.assign({
    id, title:'Untitled', desc:'', categoryId: state.categories[0].id, priority:2, deadline:null, createdAt:new Date().toISOString(), tasks:[], order: (state.goals.length? Math.max(...state.goals.map(g=>g.order))+1:0)
  }, payload);
  state.goals.push(goal);
  scheduleSave();
  renderGoals();
  toast('Goal created');
  return goal;
}
function updateGoal(id, patch){
  const g = state.goals.find(x=>x.id===id);
  if(!g) return;
  Object.assign(g, patch);
  scheduleSave();
  renderGoals();
}
function deleteGoal(id){
  const idx = state.goals.findIndex(x=>x.id===id);
  if(idx<0) return;
  const removed = state.goals.splice(idx,1)[0];
  scheduleSave();
  renderGoals();
  toast('Goal deleted', 5000, 'Undo', () => {
    state.goals.splice(idx,0,removed);
    scheduleSave();
    renderGoals();
    toast('Delete undone');
  });
}

/* tasks */
function addTask(goalId, title){
  const g = state.goals.find(x=>x.id===goalId);
  if(!g) return;
  const t = {id: UID('t'), title, done:false, order: (g.tasks.length? Math.max(...g.tasks.map(t=>t.order))+1:0)};
  g.tasks.push(t);
  scheduleSave();
  renderGoals();
  return t;
}
function toggleTask(goalId, taskId){
  const g = state.goals.find(x=>x.id===goalId); if(!g) return;
  const t = g.tasks.find(x=>x.id===taskId); if(!t) return;
  t.done = !t.done;
  scheduleSave();
  renderGoals();
}

/* ---------- Render ---------- */
function renderCategories(){
  const wrap = $('#categories'); wrap.innerHTML = '';
  state.categories.forEach(c => {
    const el = document.createElement('button');
    el.className='cat';
    el.textContent = c.name;
    el.style.border = `1px solid rgba(255,255,255,0.02)`;
    el.onclick = () => { filter.categoryId = (filter.categoryId===c.id? null: c.id); renderGoals(); renderCategories(); };
    if(filter.categoryId===c.id) el.classList.add('active');
    wrap.appendChild(el);
  });
  // fill modal select
  const s = $('#m-cat'); s.innerHTML='';
  state.categories.forEach(c=>{
    const opt = document.createElement('option'); opt.value=c.id; opt.textContent=c.name; s.appendChild(opt);
  });
}

function renderGoals(){
  const list = $('#goalsList'); list.innerHTML = '';
  let goals = state.goals.slice().sort((a,b)=> (a.order - b.order));
  // filter tabs
  if(filter.tab==='today'){
    const today = new Date(); today.setHours(0,0,0,0);
    goals = goals.filter(g => {
      if(!g.deadline) return false;
      const d = new Date(g.deadline); d.setHours(0,0,0,0);
      return +d === +today;
    });
  } else if(filter.tab==='done'){
    goals = goals.filter(g => g.tasks.length && g.tasks.every(t=>t.done));
  }
  if(filter.q) {
    const q = filter.q.toLowerCase();
    goals = goals.filter(g => g.title.toLowerCase().includes(q) || (g.desc||'').toLowerCase().includes(q) || g.tasks.some(t=>t.title.toLowerCase().includes(q)));
  }
  if(filter.categoryId) goals = goals.filter(g=>g.categoryId===filter.categoryId);

  $('#stats').textContent = `${goals.length} goals`;

  goals.forEach(g=>{
    const el = document.createElement('article'); el.className='goal'; el.draggable = true; el.dataset.id = g.id;
    // header row
    const row = document.createElement('div'); row.className='row';
    const left = document.createElement('div'); left.className='meta';
    const title = document.createElement('div'); title.innerHTML = `<strong>${escapeHtml(g.title)}</strong>`;
    const cat = state.categories.find(c=>c.id===g.categoryId);
    const pill = document.createElement('div'); pill.className='pill'; pill.textContent = cat? cat.name : 'No category';
    left.appendChild(title); left.appendChild(pill);

    const right = document.createElement('div'); right.style.display='flex';right.style.gap='8px';
    const deadline = document.createElement('div'); deadline.className='pill'; deadline.textContent = g.deadline? new Date(g.deadline).toLocaleDateString() : 'No due';
    const btns = document.createElement('div');
    const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.onclick = ()=> openModal(g.id);
    const del = document.createElement('button'); del.className='btn'; del.textContent='Del'; del.onclick = ()=> { if(confirm('Confirm delete goal?')) deleteGoal(g.id); };
    btns.appendChild(edit); btns.appendChild(del);
    right.appendChild(deadline); right.appendChild(btns);

    row.appendChild(left); row.appendChild(right);
    el.appendChild(row);

    // description
    if(g.desc){
      const d = document.createElement('div'); d.style.color='var(--muted)'; d.style.fontSize='13px'; d.textContent = g.desc; el.appendChild(d);
    }

    // tasks
    const tasksWrap = document.createElement('div'); tasksWrap.className='tasks';
    g.tasks.sort((a,b)=>a.order-b.order).forEach(t=>{
      const tEl = document.createElement('div'); tEl.className='task' + (t.done? ' done' : '');
      const chk = document.createElement('div'); chk.className='chk'; chk.innerHTML = t.done? '✓' : '';
      chk.onclick = () => toggleTask(g.id, t.id);
      const tTitle = document.createElement('div'); tTitle.textContent = t.title;
      tEl.appendChild(chk); tEl.appendChild(tTitle);
      tasksWrap.appendChild(tEl);
    });

    // add new task input
    const addRow = document.createElement('div'); addRow.style.display='flex'; addRow.style.gap='8px'; addRow.style.marginTop='6px';
    const input = document.createElement('input'); input.placeholder='Add a task...'; input.style.flex='1';
    input.onkeydown = (ev) => {
      if(ev.key === 'Enter' && input.value.trim()){
        addTask(g.id, input.value.trim()); input.value='';
      }
    };
    addRow.appendChild(input);
    el.appendChild(tasksWrap);
    el.appendChild(addRow);

    // progress
    const doneN = g.tasks.filter(t=>t.done).length, totalN = g.tasks.length;
    const pr = document.createElement('div'); pr.className='progress'; const bar = document.createElement('i'); bar.style.width = percent(doneN,totalN)+'%'; pr.appendChild(bar);
    el.appendChild(pr);

    // drag handlers
    el.addEventListener('dragstart', (e)=> {
      e.dataTransfer.setData('text/plain', g.id);
      el.style.opacity=0.5;
    });
    el.addEventListener('dragend', ()=> el.style.opacity=1);
    el.addEventListener('dragover', (e)=> e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const otherId = e.dataTransfer.getData('text/plain');
      if(otherId && otherId !== g.id){
        // swap order
        const a = state.goals.find(x=>x.id===otherId), b = g;
        const ao = a.order, bo = b.order;
        a.order = bo; b.order = ao;
        scheduleSave();
        renderGoals();
      }
    });

    list.appendChild(el);
  });

  if(goals.length===0){
    const empty = document.createElement('div'); empty.style.color='var(--muted)'; empty.style.textAlign='center'; empty.style.padding='24px'; empty.textContent='No goals yet. Tap + New to get started.';
    list.appendChild(empty);
  }
}

function escapeHtml(s){ const div=document.createElement('div'); div.textContent=s; return div.innerHTML; }

function renderAll(){
  renderCategories();
  renderGoals();
}

/* ---------- Modal UI ---------- */
const modalBackdrop = $('#modalBackdrop'); const modal = $('#modal');
function openModal(goalId=null){
  const titleEl = $('#modalTitle');
  $('#m-title').value=''; $('#m-desc').value=''; $('#m-dead').value=''; $('#m-time').value=''; $('#m-pri').value='2';
  $('#m-cat').value = state.categories[0]?.id || '';
  modalBackdrop.style.display='flex'; modalBackdrop.setAttribute('aria-hidden','false');
  if(goalId){
    titleEl.textContent='Edit Goal';
    const g = state.goals.find(x=>x.id===goalId);
    if(g){
      $('#m-title').value=g.title; $('#m-desc').value=g.desc||''; $('#m-cat').value=g.categoryId||'';
      $('#m-pri').value = g.priority || 2;
      if(g.deadline){
        const d = new Date(g.deadline); $('#m-dead').value = d.toISOString().slice(0,10); $('#m-time').value = d.toTimeString().slice(0,5);
      }
      $('#modalSave').onclick = ()=> {
        const t = $('#m-title').value.trim(); if(!t){ alert('Title cannot be empty'); return; }
        const day = $('#m-dead').value;
        const time = $('#m-time').value;
        const deadline = day? (time? new Date(day + 'T' + time) : new Date(day)) : null;
        updateGoal(goalId, { title: t, desc: $('#m-desc').value, categoryId: $('#m-cat').value, priority: Number($('#m-pri').value), deadline: deadline? deadline.toISOString():null });
        closeModal();
      };
    }
  } else {
    titleEl.textContent='Create Goal';
    $('#modalSave').onclick = ()=> {
      const t = $('#m-title').value.trim(); if(!t){ alert('Title cannot be empty'); return; }
      const day = $('#m-dead').value;
      const time = $('#m-time').value;
      const deadline = day? (time? new Date(day + 'T' + time) : new Date(day)) : null;
      createGoal({ title:t, desc: $('#m-desc').value, categoryId: $('#m-cat').value, priority: Number($('#m-pri').value), deadline: deadline? deadline.toISOString():null });
      closeModal();
    };
  }
}
function closeModal(){ modalBackdrop.style.display='none'; modalBackdrop.setAttribute('aria-hidden','true'); }

/* ---------- Export / Import ---------- */
$('#btn-backup').onclick = ()=> {
  const blob = new Blob([JSON.stringify(state, null, 2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'goalpro-backup-'+(new Date().toISOString().slice(0,10))+'.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('Backup downloaded');
};
$('#fileInput').addEventListener('change', (ev)=> {
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(!parsed || !parsed.version) throw new Error('Invalid schema');
      if(!confirm('Import will overwrite current data. Continue?')) return;
      state = parsed;
      scheduleSave(true);
      renderAll();
      toast('Import successful');
    }catch(err){
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(f);
});

/* ---------- Events ---------- */
$('#btn-new').addEventListener('click', ()=> openModal(null));
$('#modalClose').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e)=> { if(e.target === modalBackdrop) closeModal(); });

$('#q').addEventListener('input', (e)=> { filter.q = e.target.value; renderGoals(); });

$('#btn-add-cat').addEventListener('click', ()=> {
  const name = prompt('New category name:');
  if(name) { createCategory(name); }
});

$('#tab-all').addEventListener('click', ()=> { filter.tab='all'; renderGoals(); });
$('#tab-today').addEventListener('click', ()=> { filter.tab='today'; renderGoals(); });
$('#tab-completed').addEventListener('click', ()=> { filter.tab='done'; renderGoals(); });

$('#btn-filter').addEventListener('click', ()=> {
  if(Notification && Notification.permission !== 'granted'){
    if(confirm('Enable notifications to receive deadline reminders?')) {
      Notification.requestPermission().then(p => {
        toast('Notifications: ' + p);
      });
    }
  } else {
    toast('Filter panel not implemented in demo (extendable)');
  }
});

/* ---------- Init / Render ---------- */
renderAll();

/* ---------- Extra: deadline checks (notifications demo) ---------- */
setInterval(()=> {
  const now = Date.now();
  state.goals.forEach(g=>{
    if(g.deadline && !g._notified){
      const d = new Date(g.deadline).getTime();
      if(d - now < 60*60*1000 && d - now > 0){ // within next hour
        if(Notification && Notification.permission === 'granted'){
          new Notification('GoalPro: upcoming deadline', {body: g.title});
        }
        g._notified = true; scheduleSave();
      }
    }
  });
}, 60*1000);
