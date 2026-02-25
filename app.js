const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'goalpro_data';

// --- State ---
let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  categories: [{id: 'c1', name: 'General'}],
  goals: []
};
let activeTab = 'all';

// --- Save ---
const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
};

// --- Actions ---
function addGoal(title, catId, prio, deadline) {
  state.goals.push({
    id: Date.now().toString(),
    title, categoryId: catId, priority: prio, deadline,
    tasks: [],
    done: false
  });
  save();
}

function addTask(goalId, taskTitle) {
  const goal = state.goals.find(g => g.id === goalId);
  if (goal) {
    goal.tasks.push({ id: Date.now().toString(), title: taskTitle, done: false });
    save();
  }
}

function toggleTask(goalId, taskId) {
  const goal = state.goals.find(g => g.id === goalId);
  const task = goal.tasks.find(t => t.id === taskId);
  task.done = !task.done;
  save();
}

// --- UI Logic ---
function openModal() {
  const mb = $('#modalBackdrop');
  const catSelect = $('#m-cat');
  catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  mb.style.display = 'flex';
  setTimeout(() => mb.classList.add('show'), 10);
}

function closeModal() {
  const mb = $('#modalBackdrop');
  mb.classList.remove('show');
  setTimeout(() => mb.style.display = 'none', 300);
}

// --- Rendering ---
function render() {
  // Categories
  $('#categories').innerHTML = state.categories.map(c => `
    <div class="cat">${c.name}</div>
  `).join('');

  // Goals
  const list = $('#goalsList');
  list.innerHTML = state.goals.map(g => {
    const progress = g.tasks.length ? (g.tasks.filter(t => t.done).length / g.tasks.length) * 100 : 0;
    
    return `
      <div class="goal">
        <div class="goal-header">
          <div>
            <div style="font-weight:700">${g.title}</div>
            <div style="font-size:11px; color:var(--muted)">Priority: ${g.priority}</div>
          </div>
          <button class="btn" onclick="deleteGoal('${g.id}')">✕</button>
        </div>
        
        <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
        
        <div class="tasks">
          ${g.tasks.map(t => `
            <div class="task ${t.done ? 'done' : ''}" onclick="toggleTask('${g.id}', '${t.id}')">
              <div class="chk">${t.done ? '✓' : ''}</div>
              <span>${t.title}</span>
            </div>
          `).join('')}
        </div>

        <div style="display:flex; gap:8px; margin-top:12px">
          <input type="text" id="t-in-${g.id}" placeholder="New task..." style="padding:8px; font-size:13px">
          <button class="btn" onclick="handleAddTask('${g.id}')">Add</button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Global Handlers ---
window.handleAddTask = (id) => {
  const input = $(`#t-in-${id}`);
  if (input.value) {
    addTask(id, input.value);
    input.value = '';
  }
};

window.deleteGoal = (id) => {
  state.goals = state.goals.filter(g => g.id !== id);
  save();
};

window.toggleTask = toggleTask;

// --- Event Listeners ---
$('#btn-new').onclick = openModal;
$('#modalClose').onclick = closeModal;

$('#modalSave').onclick = () => {
  const title = $('#m-title').value;
  const cat = $('#m-cat').value;
  const prio = $('#m-pri').value;
  const dead = $('#m-dead').value;
  
  if (title) {
    addGoal(title, cat, prio, dead);
    closeModal();
    $('#m-title').value = '';
  }
};

$('#btn-backup').onclick = () => {
  const data = JSON.stringify(state);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'goalpro-backup.json';
  a.click();
};

$('#btn-import').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    state = JSON.parse(ev.target.result);
    save();
  };
  reader.readAsText(e.target.files[0]);
};

// Start
render();
