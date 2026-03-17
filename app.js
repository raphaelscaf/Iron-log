/* ═══════════════════════════════════════════
   IRON LOG — App v2.0
   ═══════════════════════════════════════════ */

// ─── DATA LAYER ───
const DB = {
  get plans()    { return JSON.parse(localStorage.getItem('il_plans') || '[]'); },
  set plans(v)   { localStorage.setItem('il_plans', JSON.stringify(v)); },
  get sessions() { return JSON.parse(localStorage.getItem('il_sessions') || '[]'); },
  set sessions(v){ localStorage.setItem('il_sessions', JSON.stringify(v)); },
  get medidas()  { return JSON.parse(localStorage.getItem('il_medidas') || '[]'); },
  set medidas(v) { localStorage.setItem('il_medidas', JSON.stringify(v)); },
  get apiKey()   { return localStorage.getItem('il_apikey') || ''; },
  set apiKey(v)  { localStorage.setItem('il_apikey', v); },
};

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// ─── NAVIGATION ───
const navMap = {
  's-home': 'nav-home', 's-treinar': 'nav-treinar',
  's-planos': 'nav-planos', 's-hist': 'nav-hist', 's-peso': 'nav-peso'
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (navMap[id]) document.getElementById(navMap[id]).classList.add('active');
  if (id === 's-home') renderHome();
  if (id === 's-treinar') renderTreinar();
  if (id === 's-planos') renderPlanos();
  if (id === 's-hist') renderHist();
  if (id === 's-peso') renderPeso();
}

// ─── SHEETS ───
let sessionDirty = false;

function openSheet(id, ...args) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
  if (id === 'sheet-new-session') initNewSession();
  if (id === 'sheet-plan-edit') initPlanEdit(args[0]);
  if (id === 'sheet-ai') initAi();
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('show');
  if (!document.querySelector('.overlay.show')) {
    document.body.style.overflow = '';
  }
  if (id === 'sheet-new-session') sessionDirty = false;
}

function confirmCloseSession() {
  if (sessionDirty) {
    if (!confirm('Tem certeza? Dados não salvos serão perdidos.')) return;
  }
  closeSheet('sheet-new-session');
}

function overlayClick(e, id) {
  if (e.target === document.getElementById(id)) {
    if (id === 'sheet-new-session' && sessionDirty) {
      if (!confirm('Tem certeza? Dados não salvos serão perdidos.')) return;
    }
    closeSheet(id);
  }
}

// ─── TOAST ───
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── HOME ───
function renderHome() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'BOM DIA,' : hour < 18 ? 'BOA TARDE,' : 'BOA NOITE,';
  document.getElementById('home-greeting').innerHTML = `${greet}<br>VAMOS TREINAR?`;

  const sessions = DB.sessions;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter(s => new Date(s.date + 'T12:00') >= weekStart);
  document.getElementById('st-week').textContent = weekSessions.length;
  document.getElementById('st-total').textContent = sessions.length;

  const allMedidas = DB.medidas;
  if (allMedidas.length) {
    const last = [...allMedidas].sort((a, b) => b.date.localeCompare(a.date))[0];
    document.getElementById('st-peso').textContent = last.peso ? last.peso.toString().replace('.', ',') : '—';
  } else {
    document.getElementById('st-peso').textContent = '—';
  }

  // Weekly progress dots
  renderWeekProgress(weekSessions.length);

  // Recent workouts
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const div = document.getElementById('home-hist');
  if (!recent.length) {
    div.innerHTML = `<div class="empty fade-in">
      <span class="empty-icon">🏋️</span>Nenhum treino ainda.
      <div class="empty-action"><button class="btn btn-primary btn-sm" onclick="openSheet('sheet-ai')">🤖 Criar plano com IA</button></div>
    </div>`;
    return;
  }
  div.innerHTML = recent.map(histCard).join('');
}

function renderWeekProgress(count) {
  const goal = 5;
  const dotsEl = document.getElementById('week-dots');
  const countEl = document.getElementById('week-count');
  countEl.textContent = `${count}/${goal} treinos`;
  const today = new Date().getDay();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const filled = i < count ? 'filled' : '';
    const isToday = i === today ? 'today' : '';
    html += `<div class="week-dot ${filled} ${isToday}"></div>`;
  }
  dotsEl.innerHTML = html;
}

// ─── TREINAR ───
function renderTreinar() {
  const plans = DB.plans;
  const div = document.getElementById('treinar-plans');
  if (!plans.length) {
    div.innerHTML = `<div class="empty"><span class="empty-icon">📋</span>Nenhum plano criado.
      <div class="empty-action"><button class="btn btn-ghost btn-sm" onclick="openSheet('sheet-ai')">🤖 Gerar com IA</button></div>
    </div>`;
    return;
  }
  div.innerHTML = plans.map(p => `
    <div class="quick-plan-card" onclick="quickStart('${p.id}')">
      <div class="badge ${p.group}">${p.group}</div>
      <div class="quick-plan-info">
        <div class="quick-plan-name">${esc(p.name)}</div>
        <div class="quick-plan-meta">${p.exercises.length} exercícios</div>
      </div>
      <div class="quick-plan-go">▶</div>
    </div>`).join('');
}

function quickStart(planId) {
  openSheet('sheet-new-session');
  setTimeout(() => {
    document.getElementById('sess-plan').value = planId;
    loadSessPlan();
  }, 100);
}

// ─── SESSION ───
function initNewSession() {
  sessionDirty = false;
  document.getElementById('sess-date').value = new Date().toISOString().slice(0, 10);
  const plans = DB.plans;
  const sel = document.getElementById('sess-plan');
  sel.innerHTML = '<option value="">Selecione...</option>' +
    plans.map(p => `<option value="${p.id}">${p.group} — ${esc(p.name)}</option>`).join('');
  document.getElementById('sess-exercises').innerHTML = '';
  document.getElementById('sess-notes').value = '';
}

function loadSessPlan() {
  const planId = document.getElementById('sess-plan').value;
  const container = document.getElementById('sess-exercises');
  if (!planId) { container.innerHTML = ''; return; }
  const plan = DB.plans.find(p => p.id === planId);
  if (!plan) return;

  // Find previous session for this plan to show last weights
  const prevSession = [...DB.sessions]
    .filter(s => s.planId === planId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  container.innerHTML = plan.exercises.map(ex => {
    const prevEx = prevSession?.exercises?.find(e => e.name === ex.name);
    const prevLabel = prevEx?.sets?.[0]?.weight
      ? `<span class="set-card-prev">Anterior: ${prevEx.sets[0].weight}kg</span>` : '';

    return `<div class="set-card">
      <div class="set-card-header">
        <span class="set-card-name">${esc(ex.name)}</span>
        ${prevLabel}
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);margin-left:auto;">${ex.sets}×${ex.reps}</span>
      </div>
      <div id="sets-${ex.id}">
        ${Array.from({ length: ex.sets }, (_, i) => {
          const prevSet = prevEx?.sets?.[i];
          const prevWeight = prevSet?.weight || '';
          return `<div class="set-row" id="sr-${ex.id}-${i}">
            <span class="set-num">${i + 1}</span>
            <input type="number" inputmode="decimal" step="0.5" placeholder="${prevWeight || 'kg'}" class="w-i" onchange="sessionDirty=true">
            <input type="number" inputmode="numeric" value="${ex.reps}" class="r-i" onchange="sessionDirty=true">
            <div class="set-done" onclick="toggleDone(this)" role="checkbox" aria-label="Marcar série como feita">✓</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleDone(el) {
  el.classList.toggle('checked');
  sessionDirty = true;
  if (el.classList.contains('checked')) {
    const card = el.closest('.set-card');
    const exName = card ? card.querySelector('.set-card-name')?.textContent : '';
    startTimer(60, exName);
  }
}

function saveSession() {
  const date = document.getElementById('sess-date').value;
  const planId = document.getElementById('sess-plan').value;
  const notes = document.getElementById('sess-notes').value.trim();
  if (!date || !planId) { toast('Selecione data e plano!'); return; }
  const plan = DB.plans.find(p => p.id === planId);
  const exercises = plan.exercises.map(ex => {
    const tbody = document.getElementById('sets-' + ex.id);
    const rows = tbody ? tbody.querySelectorAll('.set-row') : [];
    const sets = Array.from(rows).map(row => ({
      weight: parseFloat(row.querySelector('.w-i').value) || 0,
      reps: parseInt(row.querySelector('.r-i').value) || 0,
      done: row.querySelector('.set-done').classList.contains('checked'),
    }));
    return { id: ex.id, name: ex.name, sets };
  });
  const s = DB.sessions;
  s.push({ id: uid(), date, planId, planName: plan.name, notes, exercises, savedAt: new Date().toISOString() });
  DB.sessions = s;
  sessionDirty = false;
  closeSheet('sheet-new-session');
  toast('Treino salvo! 💪');
  renderHome();
  renderHist();
}

// ─── HISTORY ───
function histCard(s) {
  const plan = DB.plans.find(p => p.id === s.planId);
  const name = plan ? plan.name : (s.planName || 'Treino');
  const group = plan ? plan.group : '?';
  const d = new Date(s.date + 'T12:00');
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const dayStr = d.toLocaleDateString('pt-BR', { weekday: 'short' });
  const exs = s.exercises.map(e => e.name).slice(0, 2).join(', ') +
    (s.exercises.length > 2 ? ` +${s.exercises.length - 2}` : '');
  return `<div class="hist-item fade-in" onclick="viewSession('${s.id}')">
    <div class="badge ${group}">${group}</div>
    <div class="hist-info">
      <div class="hist-name">${esc(name)}</div>
      <div class="hist-meta">${esc(exs) || '—'}</div>
      ${s.notes ? `<div style="font-size:11px;color:var(--accent);margin-top:2px;font-style:italic;">"${esc(s.notes)}"</div>` : ''}
    </div>
    <div class="hist-date">${dayStr}<br>${dateStr}</div>
  </div>`;
}

function renderHist() {
  const filter = document.getElementById('hist-filter')?.value || '';
  let sessions = [...DB.sessions].sort((a, b) => b.date.localeCompare(a.date));
  if (filter) sessions = sessions.filter(s => s.planId === filter);
  const div = document.getElementById('hist-list');
  if (!sessions.length) {
    div.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>Nenhum treino encontrado.</div>';
    return;
  }
  div.innerHTML = sessions.map(histCard).join('');

  const plans = DB.plans;
  const hf = document.getElementById('hist-filter');
  const cur = hf.value;
  hf.innerHTML = '<option value="">Todos os treinos</option>' +
    plans.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${p.group} — ${esc(p.name)}</option>`).join('');
}

function viewSession(id) {
  const sess = DB.sessions.find(s => s.id === id);
  if (!sess) return;
  const plan = DB.plans.find(p => p.id === sess.planId);
  const name = plan ? plan.name : (sess.planName || 'Treino');
  const d = new Date(sess.date + 'T12:00');
  document.getElementById('view-sess-title').textContent = name.toUpperCase();
  document.getElementById('view-sess-body').innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">
      ${d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
    ${sess.notes ? `<div style="color:var(--accent);font-size:14px;margin-bottom:16px;font-style:italic;">"${esc(sess.notes)}"</div>` : ''}
    ${sess.exercises.map(ex => `
      <div class="set-card" style="margin-bottom:12px;">
        <div class="set-card-header"><span class="set-card-name">${esc(ex.name)}</span></div>
        ${ex.sets.map((s, i) => `
          <div class="set-row">
            <span class="set-num">${i + 1}</span>
            <input readonly value="${s.weight}" style="background:transparent;border:none;color:var(--text);font-weight:600;text-align:center;">
            <input readonly value="${s.reps}" style="background:transparent;border:none;color:var(--text);text-align:center;">
            <div class="set-done ${s.done ? 'checked' : ''}" style="pointer-events:none;">✓</div>
          </div>`).join('')}
      </div>`).join('')}`;
  document.getElementById('view-sess-del').onclick = () => deleteSession(id);
  openSheet('sheet-view-session');
}

function deleteSession(id) {
  if (!confirm('Excluir este treino?')) return;
  DB.sessions = DB.sessions.filter(s => s.id !== id);
  closeSheet('sheet-view-session');
  toast('Treino excluído.');
  renderHome();
  renderHist();
}

// ─── PLANOS ───
let planEditId = null;

function renderPlanos() {
  const plans = DB.plans;
  const div = document.getElementById('planos-list');
  if (!plans.length) {
    div.innerHTML = `<div class="empty"><span class="empty-icon">📋</span>Nenhum plano ainda.
      <div class="empty-action"><button class="btn btn-primary btn-sm" onclick="openSheet('sheet-ai')">🤖 Gerar com IA</button></div>
    </div>`;
    return;
  }
  div.innerHTML = plans.map(p => `
    <div class="plan-card">
      <div class="plan-card-header" onclick="togglePlanCard('${p.id}')">
        <div class="badge ${p.group}">${p.group}</div>
        <span class="plan-card-title">${esc(p.name)}</span>
        <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);">${p.exercises.length} ex.</span>
        <span class="plan-card-chevron" id="chev-${p.id}">›</span>
      </div>
      <div class="plan-card-body" id="pcb-${p.id}">
        ${p.exercises.map(e => `<div class="ex-item"><span class="ex-item-name">${esc(e.name)}</span><span class="ex-item-meta">${e.sets}×${e.reps}</span></div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-ghost btn-sm" onclick="openSheet('sheet-plan-edit','${p.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deletePlan('${p.id}')">🗑</button>
          <button class="btn btn-primary btn-sm" onclick="quickStart('${p.id}');showScreen('s-treinar')">▶ Iniciar</button>
        </div>
      </div>
    </div>`).join('');
}

function togglePlanCard(id) {
  const body = document.getElementById('pcb-' + id);
  const chev = document.getElementById('chev-' + id);
  body.classList.toggle('open');
  chev.classList.toggle('open');
}

function deletePlan(id) {
  if (!confirm('Excluir plano?')) return;
  DB.plans = DB.plans.filter(p => p.id !== id);
  renderPlanos();
  toast('Plano excluído.');
}

// ─── EDIT PLAN ───
function initPlanEdit(editId) {
  planEditId = editId || null;
  document.getElementById('plan-edit-title').textContent = editId ? 'EDITAR PLANO' : 'NOVO PLANO';
  const container = document.getElementById('pe-ex-list');
  container.innerHTML = '';
  if (editId) {
    const plan = DB.plans.find(p => p.id === editId);
    if (plan) {
      document.getElementById('pe-name').value = plan.name;
      document.getElementById('pe-group').value = plan.group;
      plan.exercises.forEach(e => peAddRow(e.name, e.sets, e.reps, e.id));
      return;
    }
  }
  document.getElementById('pe-name').value = '';
  document.getElementById('pe-group').value = 'A';
  peAddRow();
  peAddRow();
}

function peAddRow(name = '', sets = 3, reps = 12, eid = null) {
  const id = eid || uid();
  const row = document.createElement('div');
  row.className = 'ex-add-row';
  row.dataset.eid = id;
  row.innerHTML = `
    <input type="text" class="pe-n" placeholder="Exercício" value="${esc(name)}">
    <input type="number" class="pe-s" value="${sets}" inputmode="numeric" style="text-align:center;">
    <input type="number" class="pe-r" value="${reps}" inputmode="numeric" style="text-align:center;">
    <button class="btn btn-icon" onclick="this.closest('.ex-add-row').remove()" aria-label="Remover exercício">✕</button>`;
  document.getElementById('pe-ex-list').appendChild(row);
}

function savePlan() {
  const name = document.getElementById('pe-name').value.trim();
  const group = document.getElementById('pe-group').value;
  if (!name) { toast('Dê um nome ao plano!'); return; }
  const rows = document.querySelectorAll('#pe-ex-list .ex-add-row');
  const exercises = [];
  rows.forEach(r => {
    const n = r.querySelector('.pe-n').value.trim();
    const s = parseInt(r.querySelector('.pe-s').value) || 3;
    const rep = parseInt(r.querySelector('.pe-r').value) || 12;
    if (n) exercises.push({ id: r.dataset.eid || uid(), name: n, sets: s, reps: rep });
  });
  if (!exercises.length) { toast('Adicione ao menos 1 exercício!'); return; }
  let plans = DB.plans;
  if (planEditId) {
    plans = plans.map(p => p.id === planEditId ? { ...p, name, group, exercises } : p);
  } else {
    plans.push({ id: uid(), name, group, exercises, createdAt: new Date().toISOString() });
  }
  DB.plans = plans;
  closeSheet('sheet-plan-edit');
  renderPlanos();
  toast(planEditId ? 'Plano atualizado!' : 'Plano criado!');
}

// ─── DESEMPENHO / MEDIDAS ───
const MEDIDA_LABELS = {
  peso: 'Peso (kg)', cintura: 'Cintura (cm)', abdomen: 'Abdômen (cm)',
  quadril: 'Quadril (cm)', coxa: 'Coxa (cm)', braco: 'Braço (cm)',
  antebraco: 'Antebraço (cm)', peito: 'Peitoral (cm)', panturrilha: 'Panturrilha (cm)'
};

function renderPeso() {
  document.getElementById('w-date').value = new Date().toISOString().slice(0, 10);
  const medidas = [...DB.medidas].sort((a, b) => b.date.localeCompare(a.date));
  const log = document.getElementById('w-log');
  if (!medidas.length) {
    log.innerHTML = '<div class="empty" style="padding:20px 0"><span class="empty-icon">📏</span>Nenhuma medida ainda.</div>';
  } else {
    log.innerHTML = medidas.map(m => {
      const d = new Date(m.date + 'T12:00');
      const vals = Object.keys(MEDIDA_LABELS)
        .filter(k => m[k] != null && m[k] !== '')
        .map(k => `<span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);margin-right:10px;">${k}: <span style="color:var(--text)">${m[k]}</span></span>`)
        .join('');
      return `<div class="w-item">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <div class="w-date" style="font-size:13px;color:var(--text);">${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <button class="btn btn-danger btn-sm" onclick="deleteMedida('${m.id}')" aria-label="Excluir medida">✕</button>
        </div>
        <div style="flex-wrap:wrap;display:flex;gap:4px 0;">${vals}</div>
      </div>`;
    }).join('');
  }
  const metric = document.getElementById('chart-metric')?.value || 'peso';
  drawChart(medidas, metric);
}

function saveMedidas() {
  const date = document.getElementById('w-date').value;
  if (!date) { toast('Selecione a data!'); return; }
  const keys = ['peso', 'cintura', 'abdomen', 'quadril', 'coxa', 'braco', 'antebraco', 'peito', 'panturrilha'];
  const entry = { id: uid(), date };
  let hasAny = false;
  keys.forEach(k => {
    const v = parseFloat(document.getElementById('m-' + k)?.value);
    if (!isNaN(v) && v > 0) { entry[k] = v; hasAny = true; }
  });
  if (!hasAny) { toast('Preencha ao menos uma medida!'); return; }
  const m = DB.medidas;
  m.push(entry);
  DB.medidas = m;
  keys.forEach(k => { const el = document.getElementById('m-' + k); if (el) el.value = ''; });
  renderPeso();
  toast('Medidas salvas! 📏');
}

function deleteMedida(id) {
  if (!confirm('Excluir esta medida?')) return;
  DB.medidas = DB.medidas.filter(m => m.id !== id);
  renderPeso();
}

function drawChart(medidas, metric = 'peso') {
  const canvas = document.getElementById('w-canvas');
  const ctx = canvas.getContext('2d');
  const sorted = [...medidas].filter(m => m[metric] != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  const W = canvas.parentElement.offsetWidth;
  const H = 180;
  canvas.width = W * (window.devicePixelRatio || 1);
  canvas.height = H * (window.devicePixelRatio || 1);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, W, H);

  if (sorted.length < 2) {
    ctx.fillStyle = '#444';
    ctx.font = "12px 'DM Mono'";
    ctx.textAlign = 'center';
    ctx.fillText('Adicione 2+ registros de ' + (MEDIDA_LABELS[metric] || metric), W / 2, H / 2);
    return;
  }

  const vals = sorted.map(m => m[metric]);
  const mn = Math.min(...vals) - 0.5, mx = Math.max(...vals) + 0.5;
  const p = { l: 8, r: 8, t: 16, b: 12 };
  const iW = W - p.l - p.r, iH = H - p.t - p.b;
  const tx = i => p.l + i * iW / (sorted.length - 1);
  const ty = v => p.t + iH - (v - mn) / (mx - mn) * iH;

  // Grid lines
  ctx.strokeStyle = '#1a1a20';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(f => {
    ctx.beginPath();
    ctx.moveTo(p.l, p.t + iH * f);
    ctx.lineTo(W - p.r, p.t + iH * f);
    ctx.stroke();
  });

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, p.t, 0, H);
  gradient.addColorStop(0, 'rgba(200, 255, 0, 0.12)');
  gradient.addColorStop(1, 'rgba(200, 255, 0, 0.01)');
  ctx.beginPath();
  sorted.forEach((m, i) => i === 0 ? ctx.moveTo(tx(i), ty(m[metric])) : ctx.lineTo(tx(i), ty(m[metric])));
  ctx.lineTo(tx(sorted.length - 1), H - p.b);
  ctx.lineTo(p.l, H - p.b);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  sorted.forEach((m, i) => i === 0 ? ctx.moveTo(tx(i), ty(m[metric])) : ctx.lineTo(tx(i), ty(m[metric])));
  ctx.strokeStyle = '#c8ff00';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Glow line
  ctx.strokeStyle = 'rgba(200, 255, 0, 0.3)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Dots
  sorted.forEach((m, i) => {
    ctx.beginPath();
    ctx.arc(tx(i), ty(m[metric]), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#c8ff00';
    ctx.fill();
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Last value label
  const last = sorted[sorted.length - 1];
  const unit = metric === 'peso' ? 'kg' : 'cm';
  ctx.fillStyle = '#c8ff00';
  ctx.font = "bold 13px 'DM Mono'";
  ctx.textAlign = 'right';
  ctx.fillText(last[metric] + unit, W - p.r, ty(last[metric]) - 10);
}

// ─── EXPORT / IMPORT ───
function exportData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    plans: DB.plans,
    sessions: DB.sessions,
    medidas: DB.medidas,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ironlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado!');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.plans && !data.sessions && !data.medidas) {
        toast('Arquivo inválido!');
        return;
      }
      const merge = confirm('Deseja mesclar com os dados existentes? (Cancelar = substituir tudo)');
      if (merge) {
        const existingPlanIds = new Set(DB.plans.map(p => p.id));
        const existingSessionIds = new Set(DB.sessions.map(s => s.id));
        const existingMedidaIds = new Set(DB.medidas.map(m => m.id));
        DB.plans = [...DB.plans, ...(data.plans || []).filter(p => !existingPlanIds.has(p.id))];
        DB.sessions = [...DB.sessions, ...(data.sessions || []).filter(s => !existingSessionIds.has(s.id))];
        DB.medidas = [...DB.medidas, ...(data.medidas || []).filter(m => !existingMedidaIds.has(m.id))];
      } else {
        if (data.plans) DB.plans = data.plans;
        if (data.sessions) DB.sessions = data.sessions;
        if (data.medidas) DB.medidas = data.medidas;
      }
      toast('Dados importados!');
      renderHome();
      renderPeso();
    } catch (err) {
      toast('Erro ao ler arquivo!');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ─── AI TREINADOR (PLANO SEMANAL) ───
function initAi() {
  const key = DB.apiKey;
  const keySetup = document.getElementById('ai-key-setup');
  const form = document.getElementById('ai-form');
  const result = document.getElementById('ai-result');
  if (!key) {
    keySetup.style.display = 'block';
    form.style.display = 'none';
    result.style.display = 'none';
    return;
  }
  keySetup.style.display = 'none';
  form.style.display = 'block';
  result.style.display = 'none';
  // Reset button state
  document.getElementById('ai-btn-text').style.display = '';
  document.getElementById('ai-btn-loading').style.display = 'none';
  document.getElementById('ai-generate-btn').disabled = false;
}

function saveApiKey() {
  const k = document.getElementById('api-key-input').value.trim();
  if (!k.startsWith('sk-ant-')) { toast('Chave inválida!'); return; }
  DB.apiKey = k;
  initAi();
}

function selectChip(el) {
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function toggleChip(el) {
  el.classList.toggle('selected');
}

function getChipValue(containerId) {
  const selected = document.querySelector(`#${containerId} .chip.selected`);
  return selected ? selected.dataset.val : '';
}

function getChipValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .chip.selected`)).map(c => c.dataset.val);
}

function buildWeeklyPrompt() {
  const objetivos = getChipValues('ai-objetivo');
  const nivel = getChipValue('ai-nivel');
  const dias = document.getElementById('ai-dias').value;
  const tempo = document.getElementById('ai-tempo').value;
  const equipamentos = getChipValues('ai-equip');
  const obs = document.getElementById('ai-obs').value.trim();

  const plans = DB.plans;
  const plansCtx = plans.length
    ? '\nPlanos já salvos (evite duplicar): ' + plans.map(p => `"${p.name}"`).join(', ')
    : '';

  const objetivoMap = {
    hipertrofia: 'Hipertrofia (ganho de massa muscular)',
    forca: 'Força máxima',
    resistencia: 'Resistência muscular e cardiovascular',
    emagrecimento: 'Emagrecimento e definição',
    readaptacao: 'Readaptação (retorno ao treino após período parado, foco em recondicionar o corpo progressivamente)'
  };

  const nivelMap = {
    iniciante: 'Iniciante (0-6 meses de treino)',
    intermediario: 'Intermediário (6 meses a 2 anos)',
    avancado: 'Avançado (2+ anos de treino consistente)'
  };

  const objetivosTexto = objetivos.map(o => objetivoMap[o] || o).join(' + ');

  return {
    system: `Você é um personal trainer profissional certificado. Responda SEMPRE em português brasileiro.

TAREFA: Criar um plano de treino SEMANAL COMPLETO com ${dias} dias de treino.

PERFIL DO ALUNO:
- Objetivo(s): ${objetivosTexto || 'Hipertrofia'}
- Nível: ${nivelMap[nivel] || nivel}
${objetivos.includes('readaptacao') ? '- ATENÇÃO READAPTAÇÃO: O aluno está voltando a treinar após um período parado. Priorize cargas leves a moderadas, progressão gradual, exercícios com boa base técnica e menor risco de lesão. Inclua aquecimento e mobilidade. Nas primeiras semanas, foque em adaptação neuromuscular antes de aumentar volume/intensidade.' : ''}
- Dias por semana: ${dias}
- Tempo por treino: ${tempo} minutos
- Equipamentos: ${equipamentos.join(', ') || 'academia completa'}
${obs ? `- Observações: ${obs}` : ''}
${plansCtx}

EQUIPAMENTOS - ENTENDA A DIFERENÇA:
- "halter": halteres/dumbbell (pesos livres individuais)
- "barra": barra reta/EZ/W para supino, agachamento livre, rosca etc
- "maquinas": máquinas guiadas de academia (leg press, peck deck, extensora, flexora, etc)
- "smith": máquina Smith (barra guiada em trilho vertical) - ótima para agachamento Smith, supino Smith, desenvolvimento Smith etc
- "cabos": estação de cabos/crossover/polia
- "kettlebell": kettlebells
- "corporal": exercícios com peso corporal (flexão, barra fixa, dip etc)
- "elastico": faixas elásticas/rubber bands

REGRAS:
1. Distribua os grupos musculares de forma inteligente ao longo da semana
2. Use nomes de exercícios em português
3. Cada treino deve ter 4-7 exercícios adequados ao nível e equipamentos
4. USE APENAS os equipamentos que o aluno marcou como disponíveis - não sugira exercícios com equipamentos que ele não tem
4. Séries: 2-5 | Reps: 6-20 (adequar ao objetivo)
5. Para cada exercício inclua uma dica técnica CURTA (1 frase)
6. Nome cada dia de forma descritiva (ex: "Peito e Tríceps", "Pernas Completo")
7. Inclua um breve resumo de como usar o plano ao longo do mês

FORMATO DE RESPOSTA:
Primeiro, dê uma breve explicação do plano (máx 3 frases).
Depois, para cada dia, liste os exercícios com suas dicas.
No final, inclua orientações de como progredir ao longo do mês (ex: aumento de carga, volume).

IMPORTANTE: No FINAL da resposta, inclua este bloco JSON numa linha só:
%%SEMANA%%[{"dia":"Dia 1","nome":"Nome do Treino","grupo":"A","exercicios":[{"nome":"Exercício","series":3,"reps":12,"dica":"Dica técnica curta"}]}]%%FIM%%

Grupos: A=Peito, B=Costas, C=Pernas, D=Ombros, E=Braços, F=Core, G=Full Body

O array deve ter exatamente ${dias} objetos (um por dia de treino).`,
    user: `Crie meu plano semanal de ${dias} dias focado em ${objetivosTexto || 'Hipertrofia'}. Nível ${nivelMap[nivel] || nivel}. Equipamentos: ${equipamentos.join(', ')}. Tempo: ${tempo}min por treino.${obs ? ' Obs: ' + obs : ''}`
  };
}

async function generateWeeklyPlan() {
  const btn = document.getElementById('ai-generate-btn');
  const btnText = document.getElementById('ai-btn-text');
  const btnLoading = document.getElementById('ai-btn-loading');

  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';

  const prompt = buildWeeklyPrompt();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DB.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      })
    });

    const data = await res.json();

    if (data.error) {
      toast('Erro: ' + data.error.message);
      btn.disabled = false;
      btnText.style.display = '';
      btnLoading.style.display = 'none';
      return;
    }

    const rawReply = data.content[0].text;
    const weekData = extractWeekPlan(rawReply);
    const cleanText = cleanWeekReply(rawReply);

    if (weekData && weekData.length > 0) {
      const createdPlans = weekData.map(day => autoCreatePlan(day));
      showAiResult(cleanText, createdPlans);
      renderHome();
      renderTreinar();
      renderPlanos();
    } else {
      console.error('AI reply (no plan extracted):', rawReply);
      toast('Não foi possível extrair o plano. Tente novamente.');
      btn.disabled = false;
      btnText.style.display = '';
      btnLoading.style.display = 'none';
    }
  } catch (e) {
    console.error('AI error:', e);
    toast('Erro de conexão: ' + (e.message || 'Verifique a API Key.'));
    btn.disabled = false;
    btnText.style.display = '';
    btnLoading.style.display = 'none';
  }
}

function extractWeekPlan(reply) {
  const match = reply.match(/%%SEMANA%%(.+?)%%FIM%%/s);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch (e) { return null; }
}

function cleanWeekReply(reply) {
  return reply.replace(/%%SEMANA%%[\s\S]*?%%FIM%%/g, '').trim();
}

function autoCreatePlan(dayData) {
  const plan = {
    id: uid(),
    name: dayData.nome,
    group: dayData.grupo || 'G',
    exercises: (dayData.exercicios || []).map(e => ({
      id: uid(),
      name: e.nome,
      sets: e.series || 3,
      reps: e.reps || 12,
      dica: e.dica || ''
    })),
    createdAt: new Date().toISOString(),
    fromAI: true,
    dayLabel: dayData.dia || ''
  };
  const plans = DB.plans;
  plans.push(plan);
  DB.plans = plans;
  return plan;
}

function showAiResult(explanation, plans) {
  const form = document.getElementById('ai-form');
  const result = document.getElementById('ai-result');
  form.style.display = 'none';
  result.style.display = 'block';

  result.innerHTML = `
    <div class="ai-success-banner fade-in">
      <span class="ai-success-icon">🎉</span>
      <div class="ai-success-title">${plans.length} TREINOS CRIADOS!</div>
      <div class="ai-success-sub">Plano semanal salvo automaticamente</div>
    </div>

    <div class="card glass-card fade-in" style="margin-bottom:16px;">
      <div class="section-label">Sobre o plano</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);">${explanation.replace(/\n/g, '<br>')}</p>
    </div>

    <div class="section-label">Treinos da semana</div>
    ${plans.map((plan, idx) => `
      <div class="ai-plan-card fade-in" style="animation-delay:${idx * 0.1}s">
        <div class="ai-plan-header">
          <div class="badge ${plan.group}">${plan.group}</div>
          <div>
            <div class="ai-plan-day">${plan.dayLabel || 'Dia ' + (idx + 1)}</div>
            <div class="ai-plan-name">${esc(plan.name)}</div>
          </div>
        </div>
        <ul class="ai-ex-list">
          ${plan.exercises.map(e => `
            <li>
              <div class="ai-ex-item">
                <span>${esc(e.name)}</span>
                <span class="ai-ex-meta">${e.sets}×${e.reps}</span>
              </div>
              ${e.dica ? `<div class="ai-ex-dica">${esc(e.dica)}</div>` : ''}
            </li>`).join('')}
        </ul>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="aiStartSession('${plan.id}')">▶ Iniciar treino</button>
      </div>`).join('')}

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-ghost" style="flex:1;" onclick="resetAiForm()">🔄 Gerar outro</button>
      <button class="btn btn-primary" style="flex:1;" onclick="closeSheet('sheet-ai');showScreen('s-treinar')">💪 Ir treinar</button>
    </div>
  `;
}

function resetAiForm() {
  document.getElementById('ai-form').style.display = 'block';
  document.getElementById('ai-result').style.display = 'none';
  document.getElementById('ai-btn-text').style.display = '';
  document.getElementById('ai-btn-loading').style.display = 'none';
  document.getElementById('ai-generate-btn').disabled = false;
}

function aiStartSession(planId) {
  closeSheet('sheet-ai');
  openSheet('sheet-new-session');
  setTimeout(() => {
    document.getElementById('sess-plan').value = planId;
    loadSessPlan();
  }, 150);
}

// ─── REST TIMER ───
let timerInterval = null;
let timerTotal = 60;
let timerRemaining = 60;
let timerPaused = false;
const CIRCUMFERENCE = 2 * Math.PI * 90;

function startTimer(seconds, exerciseName = '') {
  clearInterval(timerInterval);
  timerTotal = seconds;
  timerRemaining = seconds;
  timerPaused = false;
  document.getElementById('timer-exercise').textContent = exerciseName ? `Próximo: ${exerciseName}` : '';
  document.getElementById('timer-overlay').classList.add('show');
  document.getElementById('timer-pause-btn').textContent = '⏸ Pausar';
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (timerPaused) return;
    timerRemaining--;
    updateTimerDisplay();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(() => {
        document.getElementById('timer-overlay').classList.remove('show');
      }, 800);
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById('timer-val').textContent = timerRemaining;
  const progress = timerRemaining / timerTotal;
  const offset = CIRCUMFERENCE * (1 - progress);
  const ringPath = document.getElementById('timer-ring-path');
  ringPath.style.strokeDashoffset = offset;
  const color = timerRemaining <= 10 ? '#ff4757' : '#c8ff00';
  ringPath.style.stroke = color;
  document.getElementById('timer-val').style.color = timerRemaining <= 10 ? '#ff4757' : '#f0f0f2';
}

function setTimer(seconds) {
  clearInterval(timerInterval);
  startTimer(seconds, document.getElementById('timer-exercise').textContent.replace('Próximo: ', ''));
}

function pauseTimer() {
  timerPaused = !timerPaused;
  document.getElementById('timer-pause-btn').textContent = timerPaused ? '▶ Retomar' : '⏸ Pausar';
}

function skipTimer() {
  clearInterval(timerInterval);
  document.getElementById('timer-overlay').classList.remove('show');
}

// ─── UTILS ───
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── SPLASH ───
window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 500);
    }
  }, 1600);
});

// ─── CANVAS RESIZE ───
window.addEventListener('resize', () => {
  if (document.getElementById('s-peso').classList.contains('active')) {
    renderPeso();
  }
});

// ─── PWA ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.addEventListener('load', () => {
  if (isInStandalone) return;
  setTimeout(showInstallButton, 800);
});

function showInstallButton() {
  if (document.getElementById('pwa-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'pwa-fab';
  fab.innerHTML = '📲';
  fab.title = 'Instalar app';
  fab.onclick = openInstallSheet;
  document.body.appendChild(fab);
}

function openInstallSheet() {
  const nativeBtn = document.getElementById('android-native-btn');
  const manualAndroid = document.getElementById('android-manual');
  if (deferredInstallPrompt) {
    nativeBtn.style.display = 'block';
    manualAndroid.style.display = 'none';
  } else {
    nativeBtn.style.display = 'none';
    manualAndroid.style.display = 'block';
  }
  document.getElementById('sheet-install').classList.add('show');
}

async function triggerInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('pwa-fab')?.remove();
      closeSheet('sheet-install');
      toast('App instalado! 🎉');
    }
    deferredInstallPrompt = null;
  }
}

// ─── INIT ───
renderHome();
