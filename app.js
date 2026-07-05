// FocusFlow app.js
const LS_TASKS='ff_tasks', LS_STATS='ff_stats', LS_SETTINGS='ff_settings';

let tasks = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
let stats = JSON.parse(localStorage.getItem(LS_STATS) || '{"date":"","sessionsToday":0,"minutesToday":0,"totalSessions":0}');
let settings = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{"focus":25,"short":5,"long":15}');

const todayStr = () => new Date().toDateString();
if(stats.date !== todayStr()){ stats.date = todayStr(); stats.sessionsToday = 0; stats.minutesToday = 0; }

function saveTasks(){ localStorage.setItem(LS_TASKS, JSON.stringify(tasks)); }
function saveStats(){ localStorage.setItem(LS_STATS, JSON.stringify(stats)); }
function saveSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }

// ---------- Tab switching ----------
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');
tabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    if(btn.dataset.view==='tasks') renderTasks();
  });
});

// ---------- Timer ----------
const MODES = { focus:'Focus Session', short:'Short Break', long:'Long Break' };
let mode = 'focus';
let secondsLeft = settings.focus*60;
let timerId = null;
let running = false;
let completedFocusCount = 0;

const display = document.getElementById('display');
const modeLabel = document.getElementById('modeLabel');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const focusMin = document.getElementById('focusMin');
const shortMin = document.getElementById('shortMin');
const longMin = document.getElementById('longMin');
const taskSelect = document.getElementById('taskSelect');
const activeTaskLabel = document.getElementById('activeTaskLabel');

focusMin.value = settings.focus;
shortMin.value = settings.short;
longMin.value = settings.long;

function fmt(s){
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return m+':'+sec;
}

function updateDisplay(){
  display.textContent = fmt(secondsLeft);
  modeLabel.textContent = MODES[mode];
  document.title = fmt(secondsLeft) + ' - ' + MODES[mode] + ' | FocusFlow';
}

function getModeSeconds(m){
  if(m==='focus') return settings.focus*60;
  if(m==='short') return settings.short*60;
  return settings.long*60;
}

function switchMode(newMode){
  mode = newMode;
  secondsLeft = getModeSeconds(mode);
  updateDisplay();
}

function tick(){
  secondsLeft--;
  if(secondsLeft < 0){
    onSessionComplete();
    return;
  }
  updateDisplay();
}

function onSessionComplete(){
  playBeep();
  if(mode === 'focus'){
    stats.sessionsToday++;
    stats.minutesToday += settings.focus;
    stats.totalSessions++;
    saveStats();
    updateStatsUI();
    completedFocusCount++;
    const next = (completedFocusCount % 4 === 0) ? 'long' : 'short';
    switchMode(next);
  } else {
    switchMode('focus');
  }
  stopTimer();
  updateDisplay();
}

function playBeep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.6);
    o.stop(ctx.currentTime+0.6);
  }catch(e){}
}

function startTimer(){
  if(running) return;
  running = true;
  timerId = setInterval(tick, 1000);
  startBtn.textContent = 'Running...';
}
function stopTimer(){
  running = false;
  clearInterval(timerId);
  startBtn.textContent = 'Start';
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', ()=>{
  stopTimer();
  secondsLeft = getModeSeconds(mode);
  updateDisplay();
});
skipBtn.addEventListener('click', ()=>{
  stopTimer();
  if(mode==='focus'){
    const next = ((completedFocusCount+1) % 4 === 0) ? 'long' : 'short';
    switchMode(next);
  } else {
    switchMode('focus');
  }
});

[focusMin, shortMin, longMin].forEach(inp=>{
  inp.addEventListener('change', ()=>{
    settings.focus = Math.max(1, parseInt(focusMin.value)||25);
    settings.short = Math.max(1, parseInt(shortMin.value)||5);
    settings.long = Math.max(1, parseInt(longMin.value)||15);
    saveSettings();
    if(!running) secondsLeft = getModeSeconds(mode);
    updateDisplay();
  });
});

taskSelect.addEventListener('change', ()=>{
  const t = tasks.find(t=>t.id === taskSelect.value);
  activeTaskLabel.innerHTML = t ? 'Working on: <b>'+escapeHtml(t.text)+'</b>' : 'No task selected';
});

function updateStatsUI(){
  document.getElementById('statSessions').textContent = stats.sessionsToday;
  document.getElementById('statMinutes').textContent = stats.minutesToday;
  document.getElementById('statStreak').textContent = stats.totalSessions;
}

// ---------- Tasks ----------
const taskInput = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function addTask(){
  const text = taskInput.value.trim();
  if(!text) return;
  const task = {
    id: Date.now().toString(),
    text,
    priority: prioritySelect.value,
    done: false,
    createdAt: new Date().toISOString()
  };
  tasks.unshift(task);
  saveTasks();
  taskInput.value = '';
  renderTasks();
  renderTaskSelect();
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e=>{ if(e.key==='Enter') addTask(); });

function renderTasks(){
  taskList.innerHTML = '';
  if(tasks.length===0){
    taskList.innerHTML = '<li class="empty">No tasks yet. Add one above!</li>';
    return;
  }
  const sorted = [...tasks].sort((a,b)=> a.done - b.done);
  sorted.forEach(task=>{
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    const prClass = task.priority==='high' ? 'priority-high' : task.priority==='med' ? 'priority-med' : 'priority-low';
    const prLabel = task.priority==='high' ? 'High' : task.priority==='med' ? 'Medium' : 'Low';
    li.innerHTML = `
      <input type="checkbox" ${task.done?'checked':''} data-id="${task.id}" class="toggle-cb">
      <div style="flex:1">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta"><span class="${prClass}">${prLabel}</span></div>
      </div>
      <button class="btn-secondary edit-btn" data-id="${task.id}">Edit</button>
      <button class="btn-danger del-btn" data-id="${task.id}">Delete</button>
    `;
    taskList.appendChild(li);
  });

  taskList.querySelectorAll('.toggle-cb').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const t = tasks.find(t=>t.id===cb.dataset.id);
      t.done = cb.checked;
      saveTasks();
      renderTasks();
    });
  });
  taskList.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tasks = tasks.filter(t=>t.id!==btn.dataset.id);
      saveTasks();
      renderTasks();
      renderTaskSelect();
    });
  });
  taskList.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t = tasks.find(t=>t.id===btn.dataset.id);
      const newText = prompt('Edit task:', t.text);
      if(newText !== null && newText.trim() !== ''){
        t.text = newText.trim();
        saveTasks();
        renderTasks();
        renderTaskSelect();
      }
    });
  });
}

function renderTaskSelect(){
  const current = taskSelect.value;
  taskSelect.innerHTML = '<option value="">— none —</option>';
  tasks.filter(t=>!t.done).forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.text;
    taskSelect.appendChild(opt);
  });
  if([...taskSelect.options].some(o=>o.value===current)) taskSelect.value = current;
  else activeTaskLabel.textContent = 'No task selected';
}

// ---------- Init ----------
updateDisplay();
updateStatsUI();
renderTasks();
renderTaskSelect();
