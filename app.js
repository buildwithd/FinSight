/* FinSight front end. Every financial figure shown here is calculated by the Java server. */
const $ = (s, r = document) => r.querySelector(s);
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const cur = n => money.format(Number(n) || 0);
const signed = n => { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + cur(Math.abs(n)); };
const short = n => {
  n = Number(n) || 0;
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return s + '₹' + (a / 1e3).toFixed(0) + 'K';
  return s + '₹' + a.toFixed(0);
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Field definitions and demo data ---------- */
const FIELD = {
  name: ['Name', 'text'],
  income: ['Monthly take-home income (₹)', 'number'],
  expenses: ['Monthly expenses (₹)', 'number'],
  existingEmi: ['Existing EMI per month (₹)', 'number'],
  existingDebt: ['Outstanding loan principal (₹)', 'number'],
  savings: ['Liquid savings (₹)', 'number'],
  emergencySavings: ['Of which emergency savings (₹)', 'number'],
  monthlyInvestment: ['Monthly investment (₹)', 'number'],
  investmentValue: ['Current investment value (₹)', 'number'],
  investmentReturn: ['Assumed annual return (%)', 'number'],
  goal: ['Goal name', 'text'],
  goalAmount: ['Goal target amount (₹)', 'number'],
  goalSaved: ['Already saved for goal (₹)', 'number'],
  goalMonths: ['Goal timeline (months)', 'number']
};
const DEMO = {
  name: 'Arjun Mehta', income: 91000, expenses: 38000, existingEmi: 14200, existingDebt: 390000,
  savings: 235000, emergencySavings: 155000, monthlyInvestment: 9000, investmentValue: 120000, investmentReturn: 12,
  goal: 'Home down payment', goalAmount: 800000, goalSaved: 80000, goalMonths: 24
};
const withDefaults = p => ({ investmentValue: 0, investmentReturn: 12, goalAmount: 0, goalSaved: 0, goalMonths: 0, goal: '', ...p });

/* ---------- Local storage ---------- */
const Store = {
  get() { try { return JSON.parse(localStorage.finsight || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.finsight = JSON.stringify(v); } catch { toast('Could not save to browser storage.'); } },
  profile() { return this.get().profile || {}; },
  saveProfile(p) { const s = this.get(); s.profile = p; s.demo = false; this.set(s); },
  demo() { const s = this.get(); s.profile = { ...DEMO }; s.demo = true; this.set(s); this.log('Demo profile loaded'); },
  log(text) { const s = this.get(); s.activity = [...(s.activity || []), { text, time: Date.now() }].slice(-200); this.set(s); },
  saveSim(name, data) { const s = this.get(); s.sims = [...(s.sims || []), { id: Date.now(), name, time: Date.now(), data }]; this.set(s); this.log('Saved simulation: ' + name); },
  deleteSim(id) { const s = this.get(); s.sims = (s.sims || []).filter(x => x.id !== id); this.set(s); }
};

/* ---------- Shell, routing, helpers ---------- */
const nav = [
  ['dashboard', 'Overview', 'i-grid'], ['simulator', 'Decision Simulator', 'i-sim'], ['profile', 'Profile', 'i-user'],
  ['cashflow', 'Income & Expenses', 'i-income'], ['loans', 'Loans', 'i-loan'], ['savings', 'Savings & Emergency Fund', 'i-shield'],
  ['goals', 'Goals', 'i-target'], ['investments', 'Investments', 'i-trend'], ['saved', 'Saved Simulations', 'i-bookmark'],
  ['activity', 'Activity', 'i-clock'], ['settings', 'Settings', 'i-settings']
];
const state = { route: 'dashboard', result: null, last: null, lastAlt: null, token: 0 };

function icon(id) { return `<svg><use href="#${id}"/></svg>`; }
function toast(t) { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; $('#toasts').append(e); setTimeout(() => e.remove(), 3500); }
function route() { state.token++; state.route = location.hash.slice(2).split('/')[0] || 'dashboard'; render(); }
window.addEventListener('hashchange', route);

// Inline style attributes are blocked by the server's CSP, so dynamic sizes are applied here.
function applyStyles() {
  document.querySelectorAll('[data-w]').forEach(e => { e.style.width = e.dataset.w + '%'; });
  document.querySelectorAll('[data-n]').forEach(e => e.style.setProperty('--n', e.dataset.n));
  document.querySelectorAll('[data-left]').forEach(e => { e.style.left = e.dataset.left + '%'; });
}

function shell(body, title, lead) {
  const demo = Store.get().demo;
  $('#app').innerHTML = `<div class="shell"><aside class="side"><div class="brand">FIN<b>SIGHT</b><small>DECISION INTELLIGENCE</small></div><nav class="nav">${nav.map(n => `<button data-route="${n[0]}" class="${state.route === n[0] ? 'active' : ''}" ${state.route === n[0] ? 'aria-current="page"' : ''}>${icon(n[2])}${n[1]}</button>`).join('')}</nav></aside><main id="main" class="content"><header class="top"><div><h1 tabindex="-1">${title}</h1><p>${lead || 'Personal Financial Decision Intelligence Platform'}</p></div><div class="actions"><span class="badge ${demo ? 'demo' : ''}">${demo ? 'Demo mode' : 'Local-only data'}</span> <button class="btn primary" id="newSim">New simulation</button></div></header>${body}</main></div>`;
  document.querySelectorAll('[data-route]').forEach(b => { b.onclick = () => { location.hash = '/' + b.dataset.route; }; });
  $('#newSim').onclick = () => { location.hash = '/simulator'; };
  applyStyles();
  const h = $('#main h1');
  if (h) h.focus({ preventScroll: true });
}

async function api(path, data) {
  let r;
  try { r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
  catch { const e = new Error('Java server unreachable'); e.offline = true; throw e; }
  let x = {};
  try { x = await r.json(); } catch { /* ignore */ }
  if (!r.ok) throw Error(x.error || 'Server error');
  return x;
}

function problem(title, e) {
  shell(`<div class="notice risk">${e.offline ? 'The Java server is not running. Start it with <code>java --add-modules jdk.httpserver FinSightServer</code> and press Retry.' : esc(e.message)}</div><button class="btn primary" id="retry">Retry</button>`, title);
  $('#retry').onclick = () => render();
}

function needProfile(title) {
  shell(`<section class="card empty"><h2>Add your financial profile first</h2><p>Load a realistic demo profile to explore FinSight, or enter your own numbers.</p><button class="btn primary" id="loadDemo">Load demo data</button> <button class="btn" id="setProfile">Set up profile</button></section>`, title);
  $('#loadDemo').onclick = () => { Store.demo(); toast('Demo data loaded.'); render(); };
  $('#setProfile').onclick = () => { location.hash = '/profile'; };
}

/* ---------- Reusable UI pieces ---------- */
const tile = (l, v, n, c = '') => `<article class="card stat"><label>${l}</label><strong>${v}</strong><em class="${c}">${n || ''}</em></article>`;
const SEV = { risk: ['Needs attention', 'sev-risk'], watch: ['Keep an eye on', 'sev-watch'], info: ['Good to know', 'sev-info'] };
const ORDER = { risk: 0, watch: 1, info: 2 };

function insightCards(list, metric) {
  const l = (list || []).filter(i => !metric || i.metric === metric).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  if (!l.length) return '<p class="muted">Nothing to flag here.</p>';
  return l.map(i => { const [s, c] = SEV[i.severity] || SEV.info; return `<div class="sev ${c}"><b>${s}</b><p>${esc(i.text)}</p></div>`; }).join('');
}
const sevKey = () => '<div class="sev-key"><span class="chip">Needs attention: act soon</span><span class="chip">Keep an eye on: watch this</span><span class="chip">Good to know: for information</span></div>';

function editor(keys, p, id) {
  return `<form class="form" id="${id}">${keys.map(k => {
    const [l, t] = FIELD[k];
    const optional = k === 'name' || k === 'goal';
    return `<label>${l}<input name="${k}" type="${t}" ${t === 'number' ? 'min="0" step="any"' : 'maxlength="80"'} value="${esc(p[k] ?? (t === 'number' ? 0 : ''))}" ${optional ? '' : 'required'}></label>`;
  }).join('')}<div class="full"><button class="btn primary">Save changes</button></div></form>`;
}

function bindEditor(id, keys, after) {
  const f = $('#' + id);
  f.onsubmit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), p = { ...Store.profile() };
    for (const k of keys) {
      if (FIELD[k][1] === 'number') {
        const v = Number(d[k]);
        if (!Number.isFinite(v) || v < 0) return toast('Use valid non-negative numbers.');
        p[k] = v;
      } else p[k] = String(d[k] || '').trim().slice(0, 80);
    }
    if (p.emergencySavings > p.savings) return toast('Emergency savings cannot exceed liquid savings.');
    if (p.investmentReturn > 40) return toast('Assumed return must be between 0 and 40%.');
    if (!Number.isInteger(p.goalMonths || 0)) return toast('Goal timeline must be whole months.');
    Store.saveProfile(p);
    Store.log('Updated ' + keys.map(k => FIELD[k][0]).join(', '));
    toast('Saved.');
    after();
  };
}

/* ---------- Overview ---------- */
async function dashboard(p) {
  if (!p.income) return needProfile('Overview');
  const t = ++state.token;
  shell('<div class="card skeleton">Calculating your overview…</div>', 'Overview');
  let s;
  try { s = await api('/api/profile/summary', withDefaults(p)); } catch (e) { if (t === state.token) problem('Overview', e); return; }
  if (t !== state.token) return;
  shell(`<section class="grid">${tile('Monthly income', cur(s.income), 'Take-home')}${tile('Monthly expenses', cur(s.expenses), s.expensesPct + '% of income')}${tile('Existing EMIs', cur(s.emi), s.dti + '% of income')}${tile('Monthly surplus', cur(s.surplus), s.savingsRate + '% savings rate', s.surplus < 0 ? 'bad' : '')}${tile('Liquid savings', cur(s.savings), 'Cash and deposits')}${tile('Emergency cover', s.coverage + ' months', 'Target: 6 months', s.coverage < 3 ? 'bad' : s.coverage < 6 ? 'warn' : '')}${tile('Net worth snapshot', cur(s.netWorth), 'Savings minus loans')}${tile('Debt-to-income', s.dti + '%', 'EMI ÷ income')}</section>
  <section class="section cols"><article class="card"><div class="section-head"><h2>What the numbers say</h2><span class="chip">Calculated by Java</span></div>${insightCards(s.insights)}${sevKey()}</article>
  <div><article class="card"><div class="section-head"><h2>Financial health</h2></div><div class="row"><div class="ring" data-n="${s.score}"><span>${s.score}</span></div><p class="muted">Score out of 100, based on savings rate, debt-to-income, emergency cover and loans outstanding.</p></div></article>
  <article class="card section"><h2>Try a decision</h2><p class="muted">See how a purchase, loan or new expense changes your savings, debt and emergency cover over 36 months.</p><button class="btn primary" id="dashSim">Simulate a decision</button></article></div></section>`, 'Overview');
  $('#dashSim').onclick = () => { location.hash = '/simulator'; };
}

/* ---------- Profile ---------- */
function profilePage(p) {
  const keys = Object.keys(FIELD);
  shell(`<section class="card"><div class="section-head"><h2>Your financial profile</h2><button class="btn" id="demo">Load demo data</button></div>${editor(keys, withDefaults(p), 'profileForm')}</section>`, 'Profile', 'Everything is stored only in this browser.');
  $('#demo').onclick = () => { Store.demo(); toast('Demo profile loaded.'); render(); };
  bindEditor('profileForm', keys, () => { location.hash = '/dashboard'; });
}

/* ---------- Data pages: each has its own content and its own edit form ---------- */
const DATA_PAGES = {
  cashflow: {
    title: 'Income & Expenses', lead: 'Where each month of income goes before any new decision.', fields: ['income', 'expenses'],
    body: s => {
      const seg = [
        ['Expenses', s.expenses, s.expensesPct, 'seg-exp'], ['Existing EMIs', s.emi, s.emiPct, 'seg-emi'],
        ['Investments', s.investment, s.investmentPct, 'seg-inv'], ['Left over', s.surplus, s.surplusPct, 'seg-sur']
      ];
      const tot = seg.reduce((a, x) => a + Math.max(0, Number(x[2])), 0) || 1;
      return `<section class="grid">${tile('Monthly income', cur(s.income), 'Take-home')}${tile('Expenses', cur(s.expenses), s.expensesPct + '% of income')}${tile('Existing EMIs', cur(s.emi), s.emiPct + '% of income')}${tile('Left over', cur(s.surplus), s.surplusPct + '% of income', s.surplus < 0 ? 'bad' : '')}</section>
      <section class="card section"><div class="section-head"><h2>Where your income goes</h2><span class="chip">Share of monthly income</span></div><div class="alloc" role="img" aria-label="Income allocation bar">${seg.map(x => `<i class="${x[3]}" data-w="${(Math.max(0, Number(x[2])) / tot * 100).toFixed(2)}"></i>`).join('')}</div><div class="legend">${seg.map(x => `<span><i class="dot ${x[3]}"></i>${x[0]}: ${cur(x[1])} (${x[2]}%)</span>`).join('')}</div></section>
      <section class="card section"><h2>What this means</h2>${insightCards(s.insights, 'cashflow')}${sevKey()}</section>`;
    }
  },
  loans: {
    title: 'Loans', lead: 'Your current EMI burden and a calculator for any new loan.', fields: ['existingEmi', 'existingDebt'],
    body: s => `<section class="grid g3">${tile('Monthly EMI', cur(s.emi), 'Existing commitments')}${tile('Outstanding principal', cur(s.debt), 'Total still owed')}${tile('Debt-to-income', s.dti + '%', 'EMI ÷ income', s.dti > 40 ? 'bad' : s.dti > 30 ? 'warn' : '')}</section>
      <section class="card section"><div class="section-head"><h2>Where your EMI load sits</h2></div><div class="band-wrap"><div class="band-track"><i class="z-ok"></i><i class="z-watch"></i><i class="z-risk"></i></div><b class="marker" data-left="${Math.min(100, s.dti / 60 * 100).toFixed(2)}" title="Your debt-to-income: ${s.dti}%"></b></div><div class="band-labels"><span>Comfortable: under 30%</span><span>Watch: 30–40%</span><span>Stretched: over 40%</span></div></section>
      <section class="card section"><h2>What this means</h2>${insightCards(s.insights, 'debt')}${sevKey()}</section>
      <section class="card section"><div class="section-head"><h2>EMI calculator</h2><span class="chip">Calculated by Java</span></div><form class="form" id="calcForm"><label>Loan amount (₹)<input name="principal" type="number" min="1" step="any" value="500000" required></label><label>Annual interest rate (%)<input name="rate" type="number" min="0" max="75" step="any" value="10" required></label><label>Tenure (months)<input name="months" type="number" min="1" max="600" step="1" value="60" required></label><div class="full"><button class="btn primary">Calculate EMI</button></div></form><div id="calcOut" class="section"></div></section>`,
    after: () => {
      $('#calcForm').onsubmit = async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        const b = { principal: +d.principal, annualRatePercent: +d.rate, tenureMonths: +d.months };
        if (!(b.principal > 0) || !(b.annualRatePercent >= 0 && b.annualRatePercent <= 75) || !Number.isInteger(b.tenureMonths) || b.tenureMonths < 1 || b.tenureMonths > 600) return toast('Enter an amount above 0, a rate of 0–75% and a tenure of 1–600 whole months.');
        try {
          const x = await api('/api/emi', b);
          $('#calcOut').innerHTML = `<div class="grid g3">${tile('Monthly EMI', cur(x.monthlyEmi), 'Paid every month')}${tile('Total interest', cur(x.totalInterest), 'Over the full tenure')}${tile('Total payable', cur(x.totalPayable), 'Principal + interest')}</div><div class="table-wrap section"><table><thead><tr><th>Month</th><th>EMI</th><th>Interest</th><th>Principal</th><th>Balance</th></tr></thead><tbody>${x.schedule.slice(0, 12).map(r => `<tr><td>${r.month}</td><td>${cur(r.emi)}</td><td>${cur(r.interest)}</td><td>${cur(r.principal)}</td><td>${cur(r.closingBalance)}</td></tr>`).join('')}</tbody></table></div><p class="muted">First 12 months shown. Early EMIs are mostly interest.</p>`;
        } catch (err) { toast(err.offline ? 'Java server not running.' : err.message); }
      };
    }
  },
  savings: {
    title: 'Savings & Emergency Fund', lead: 'How long your savings would last if income stopped.', fields: ['savings', 'emergencySavings'],
    body: s => {
      const pct = s.emergencyTarget > 0 ? Math.min(100, s.emergencySavings / s.emergencyTarget * 100) : 0;
      const when = s.monthsToEmergencyTarget === 0 ? 'Target met.' : s.monthsToEmergencyTarget > 0 ? `About ${s.monthsToEmergencyTarget} months to close the gap at your current monthly surplus.` : 'Not reachable while your monthly surplus is zero or negative.';
      return `<section class="grid">${tile('Liquid savings', cur(s.savings), 'All cash and deposits')}${tile('Emergency savings', cur(s.emergencySavings), 'Set aside for emergencies')}${tile('Emergency cover', s.coverage + ' months', 'Target: 6 months', s.coverage < 3 ? 'bad' : s.coverage < 6 ? 'warn' : '')}${tile('6-month target', cur(s.emergencyTarget), 'Shortfall: ' + cur(s.emergencyShortfall))}</section>
      <section class="card section"><div class="section-head"><h2>Progress to a 6-month emergency fund</h2><span class="chip">${s.coverage} of 6 months</span></div><div class="progress big" role="img" aria-label="Emergency fund progress"><i data-w="${pct.toFixed(1)}"></i></div><p class="muted">${when}</p><p class="muted">Cover = emergency savings ÷ (monthly expenses + EMIs).</p></section>
      <section class="card section"><h2>What this means</h2>${insightCards(s.insights, 'emergency')}${sevKey()}</section>`;
    }
  },
  goals: {
    title: 'Goals', lead: 'Your main financial goal and what it needs each month.', fields: ['goal', 'goalAmount', 'goalSaved', 'goalMonths'],
    body: (s, p) => {
      if (!(Number(s.goalAmount) > 0)) return '<section class="card empty"><h2>No goal set yet</h2><p>Add a goal name, target amount and timeline in the form below to see what it needs each month.</p></section>';
      const reach = s.goalMonthsAtSurplus === 0 ? 'Goal already reached.' : s.goalMonthsAtSurplus > 0 ? `At your current surplus it would take about ${s.goalMonthsAtSurplus} months${p.goalMonths ? ` (your timeline is ${p.goalMonths})` : ''}.` : 'Your surplus is zero or negative, so this goal cannot be funded from monthly cash flow.';
      return `<section class="card"><div class="section-head"><h2>${esc(p.goal || 'Your goal')}</h2><span class="chip">${s.goalProgressPct}% saved</span></div><div class="row"><div class="ring" data-n="${s.goalProgressPct}"><span>${Math.round(s.goalProgressPct)}%</span></div><p class="muted">${reach}</p></div></section>
      <section class="grid section">${tile('Target', cur(s.goalAmount), 'Goal amount')}${tile('Saved so far', cur(s.goalSaved), s.goalProgressPct + '% of target')}${tile('Still needed', cur(s.goalRemaining), 'Remaining')}${tile('Needed per month', cur(s.goalRequiredMonthly), s.goalGapMonthly > 0 ? 'Short by ' + cur(s.goalGapMonthly) + ' a month' : 'Fits your surplus', s.goalGapMonthly > 0 ? 'warn' : '')}</section>
      <section class="card section"><h2>What this means</h2>${insightCards(s.insights, 'goal')}${sevKey()}</section>`;
    }
  },
  investments: {
    title: 'Investments', lead: 'What your monthly investing could grow to under your own assumptions.', fields: ['monthlyInvestment', 'investmentValue', 'investmentReturn'],
    body: s => `<section class="grid g3">${tile('Monthly investment', cur(s.investment), s.investmentPct + '% of income')}${tile('Current value', cur(s.investmentValue), 'Existing holdings')}${tile('Assumed return', s.investmentReturn + '% a year', 'Your assumption')}</section>
      <section class="card section"><div class="section-head"><h2>Projected value</h2><span class="chip">Illustration only</span></div><div class="table-wrap"><table><thead><tr><th>After</th><th>Projected value</th><th>You contribute</th><th>Assumed growth</th></tr></thead><tbody>${s.investmentProjection.map(r => `<tr><td>${r.months} months</td><td>${cur(r.value)}</td><td>${cur(r.contributed)}</td><td>${cur(r.growth)}</td></tr>`).join('')}</tbody></table></div><div class="notice section">These figures use the return you entered, compounded monthly with contributions at month end. They are not predictions, guaranteed returns or investment advice.</div></section>
      <section class="card section"><h2>What this means</h2>${insightCards(s.insights, 'investment')}${sevKey()}</section>`
  }
};

async function dataPage(r, p) {
  const cfg = DATA_PAGES[r];
  if (!p.income) return needProfile(cfg.title);
  const t = ++state.token;
  shell('<div class="card skeleton">Calculating…</div>', cfg.title, cfg.lead);
  const wp = withDefaults(p);
  let s;
  try { s = await api('/api/profile/summary', wp); } catch (e) { if (t === state.token) problem(cfg.title, e); return; }
  if (t !== state.token) return;
  shell(cfg.body(s, wp) + `<section class="card section"><div class="section-head"><h2>Update these figures</h2></div>${editor(cfg.fields, wp, 'editForm')}</section>`, cfg.title, cfg.lead);
  bindEditor('editForm', cfg.fields, () => render());
  if (cfg.after) cfg.after();
}

/* ---------- Decision Simulator ---------- */
const TYPE_HINTS = {
  purchase: 'The upfront payment comes out of savings, the loan amount is financed, and the monthly cost applies from the start month.',
  loan: 'A new loan: set the principal, rate and tenure. Set the upfront payment to 0 unless there is a fee.',
  recurring: 'A new monthly expense or subscription. Loan fields are ignored; enter the amount as the recurring monthly cost.',
  custom: 'Use the monthly cost for a recurring change and the monthly income change for a pay rise or cut (use a negative number for a cut).'
};

function simulator(p) {
  if (!p.income) return needProfile('Decision Simulator');
  const L = state.last || {};
  const v = (k, d) => esc(L[k] ?? d);
  const types = [['purchase', 'Major purchase'], ['loan', 'New loan'], ['recurring', 'Recurring expense'], ['custom', 'Custom commitment']];
  shell(`<section class="cols"><article class="card"><div class="section-head"><h2>Decision inputs</h2><span class="chip">Java calculation core</span></div><form id="simForm" class="form">
    <label>Decision type<select name="type" id="simType">${types.map(t => `<option value="${t[0]}" ${(L.type || 'purchase') === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label>
    <label>Decision name<input name="name" maxlength="60" value="${v('name', 'Car purchase')}"></label>
    <p class="muted full hint" id="typeHint">${TYPE_HINTS[L.type || 'purchase']}</p>
    <label>Loan amount (₹)<input name="loanPrincipal" type="number" min="0" step="any" value="${v('loanPrincipal', 550000)}"></label>
    <label>Annual interest rate (%)<input name="annualRate" type="number" min="0" max="75" step="any" value="${v('annualRate', 9.5)}"></label>
    <label>Loan tenure (months)<input name="tenureMonths" type="number" min="1" max="600" step="1" value="${v('tenureMonths', 60)}"></label>
    <label>Upfront / down payment (₹)<input name="upfront" type="number" min="0" step="any" value="${v('upfront', 100000)}"></label>
    <label>Recurring monthly cost (₹)<input name="monthlyCost" type="number" min="0" step="any" value="${v('monthlyCost', 6000)}"></label>
    <label>Starts in month<input name="startMonth" type="number" min="1" max="36" step="1" value="${v('startMonth', 1)}"></label>
    <label>Monthly income change (₹)<input name="incomeChange" type="number" step="any" value="${v('incomeChange', 0)}"></label>
    <div class="full"><button class="btn primary" id="runSim">Run simulation</button> <button type="button" class="btn" id="print">Print results</button></div></form></article>
    <article class="card"><h2>How the alternative is built</h2><p class="muted">Alongside your proposal, FinSight compares a lower-cost variant built from your inputs. It is a comparison, not advice.</p><ul class="muted"><li>20% smaller loan amount</li><li>25% larger upfront payment</li><li>30% lower recurring monthly cost</li><li>Loan tenure 12 months shorter (never below 12 months)</li></ul><p class="muted">Both versions are calculated by the Java server against your saved profile.</p></article></section>
    <section class="section" id="results">${state.result ? results(state.result) : '<div class="card empty">Enter a decision and select Run simulation. The browser only displays the results; Java does the math.</div>'}</section>`, 'Decision Simulator', 'Compare your current path with a proposed decision and a lower-cost alternative.');
  $('#simType').onchange = e => { $('#typeHint').textContent = TYPE_HINTS[e.target.value]; };
  $('#print').onclick = () => window.print();
  $('#simForm').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    Object.keys(d).forEach(k => { if (k !== 'type' && k !== 'name') d[k] = +d[k]; });
    d.name = (d.name || 'Decision').trim().slice(0, 60) || 'Decision';
    const bad = ['loanPrincipal', 'upfront', 'monthlyCost'].some(k => !(d[k] >= 0)) || !(d.annualRate >= 0 && d.annualRate <= 75) || !Number.isInteger(d.tenureMonths) || d.tenureMonths < 1 || d.tenureMonths > 600 || !Number.isInteger(d.startMonth) || d.startMonth < 1 || d.startMonth > 36 || !Number.isFinite(d.incomeChange);
    if (bad) return toast('Check the inputs: amounts cannot be negative, rate 0–75%, tenure 1–600 months, start month 1–36.');
    const alt = { ...d, name: d.name + ' (alternative)', loanPrincipal: Math.round(d.loanPrincipal * 0.8), upfront: Math.round(d.upfront * 1.25), monthlyCost: Math.round(d.monthlyCost * 0.7), tenureMonths: Math.max(Math.min(12, d.tenureMonths), d.tenureMonths - 12) };
    const btn = $('#runSim'); btn.disabled = true; btn.textContent = 'Calculating…';
    try {
      const x = await api('/api/simulate', { profile: withDefaults(p), decision: d, alternative: alt });
      state.result = x; state.last = d; state.lastAlt = alt;
      Store.log('Ran simulation: ' + d.name);
      toast('Simulation completed by the Java engine.');
      simulator(Store.profile());
      $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { toast(err.offline ? 'Java server not running. Start it and try again.' : err.message); btn.disabled = false; btn.textContent = 'Run simulation'; }
  };
  if (state.result) afterResults();
}

function deltaChip(d, better) {
  d = Number(d) || 0;
  if (Math.abs(d) < 0.5) return '<span class="delta flat">No change</span>';
  const good = better === 'higher' ? d > 0 : d < 0;
  return `<span class="delta ${good ? 'good' : 'bad'}">${good ? 'Better' : 'Worse'}: ${signed(d)} vs current</span>`;
}

function results(x) {
  const c = x.current, pr = x.proposed, dl = x.deltas.proposed;
  const verdict = [
    ['Monthly surplus', 'surplus', 'higher'], ['Savings after 36 months', 'savings36', 'higher'],
    ['Lowest savings balance', 'lowestSavings', 'higher'], ['Debt after 36 months', 'debt36', 'lower']
  ];
  const ss = [x.current, x.proposed, x.alternative];
  const fmt = { c: n => cur(n), mo: n => n + ' months', m: n => n < 0 ? 'Never' : 'Month ' + n };
  const rows = [
    ['Monthly income', 'monthlyIncome', 'c'], ['Monthly expenses', 'monthlyExpenses', 'c'], ['Total EMI', 'totalEmi', 'c'], ['New EMI', 'newEmi', 'c'],
    ['Monthly surplus', 'surplus', 'c'], ['Upfront cash outlay', 'upfront', 'c'], ['Savings after 12 months', 'savings12', 'c'],
    ['Savings after 24 months', 'savings24', 'c'], ['Savings after 36 months', 'savings36', 'c'], ['Lowest savings balance', 'lowestSavings', 'c'],
    ['First month savings go negative', 'firstNegativeMonth', 'm'], ['Debt after 36 months', 'debt36', 'c'], ['Interest on the new loan', 'totalInterest', 'c'], ['Emergency cover', 'coverage', 'mo']
  ];
  const alt = state.lastAlt;
  return `<div class="card"><div class="section-head"><h2>What “${esc(state.last ? state.last.name : 'this decision')}” changes</h2><span class="chip">Proposed vs current</span></div><div class="grid">${verdict.map(r => `<article class="card stat"><label>${r[0]}</label><div class="ba"><span>${cur(c[r[1]])}<small>Current</small></span><i>→</i><span>${cur(pr[r[1]])}<small>Proposed</small></span></div>${deltaChip(dl[r[1]], r[2])}</article>`).join('')}</div></div>
  <div class="card section"><div class="section-head"><h2>What the numbers say about this decision</h2><span class="chip">Calculated by Java</span></div>${insightCards(x.insights)}${sevKey()}</div>
  <div class="card section"><div class="section-head"><h2>Three-scenario comparison</h2><button class="btn small" id="saveSimulation">Save simulation</button></div><div class="table-wrap"><table><thead><tr><th>Metric</th>${ss.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td>${ss.map(s => `<td>${fmt[r[2]](s[r[1]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${alt ? `<p class="muted">Alternative used: loan ${cur(alt.loanPrincipal)}, upfront ${cur(alt.upfront)}, monthly cost ${cur(alt.monthlyCost)}, tenure ${alt.tenureMonths} months.</p>` : ''}</div>
  <div class="section cols"><article class="card"><div class="section-head"><h2>Savings projection</h2><span class="chip">36 months</span></div><svg class="chart" id="lineChart" role="img" aria-label="Savings balance over 36 months for the current, proposed and alternative scenarios"></svg><div class="legend"><span><i class="dot c1"></i>Current</span><span><i class="dot c2"></i>Proposed</span><span><i class="dot c3"></i>Alternative</span></div></article>
  <article class="card"><h2>Assumptions</h2>${x.assumptions.map(a => `<p class="muted">${esc(a)}</p>`).join('')}</article></div>`;
}

function afterResults() {
  draw();
  const b = $('#saveSimulation');
  if (b) b.onclick = () => {
    Store.saveSim(state.last ? state.last.name : 'Simulation', { profile: Store.profile(), decision: state.last, alternative: state.lastAlt, result: state.result });
    b.disabled = true; b.textContent = 'Saved'; toast('Saved to Saved Simulations.');
  };
}

function draw() {
  const x = state.result, svg = $('#lineChart');
  if (!x || !svg || !x.current.points) return;
  const w = svg.clientWidth || 700, h = 270, L = 66, R = 16, T = 12, B = 30;
  const all = [x.current, x.proposed, x.alternative], colors = ['#34d399', '#5b8def', '#8b7cf6'];
  const vals = all.flatMap(s => s.points.map(p => Number(p.savings)));
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const X = i => L + i * (w - L - R) / 36, Y = val => T + (1 - (val - min) / range) * (h - T - B);
  const path = s => s.points.map((p, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(Number(p.savings)).toFixed(1)}`).join(' ');
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const val = min + range * i / 4, y = Y(val).toFixed(1);
    g += `<line x1="${L}" y1="${y}" x2="${w - R}" y2="${y}" stroke="#6f7ba0" stroke-opacity=".18"/><text x="${L - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end" fill="#a5b0ce" font-size="11">${short(val)}</text>`;
  }
  if (min < 0 && max > 0) g += `<line x1="${L}" y1="${Y(0).toFixed(1)}" x2="${w - R}" y2="${Y(0).toFixed(1)}" stroke="#f2677a" stroke-dasharray="4 4"/>`;
  [[0, 'Now'], [12, '12m'], [24, '24m'], [36, '36m']].forEach(m => { g += `<text x="${X(m[0]).toFixed(1)}" y="${h - 8}" text-anchor="${m[0] === 0 ? 'start' : m[0] === 36 ? 'end' : 'middle'}" fill="#a5b0ce" font-size="11">${m[1]}</text>`; });
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = g + all.map((s, i) => `<path d="${path(s)}" stroke="${colors[i]}" stroke-width="3" fill="none"/>`).join('');
}

/* ---------- Saved simulations, activity, settings ---------- */
function saved() {
  const sims = Store.get().sims || [];
  shell(`<section class="card"><h2>Saved simulations</h2>${sims.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Saved</th><th>Actions</th></tr></thead><tbody>${sims.slice().reverse().map(s => `<tr><td>${esc(s.name)}</td><td>${new Date(s.time).toLocaleString('en-IN')}</td><td><button class="btn small" data-open="${s.id}">Open</button> <button class="btn small danger" data-del="${s.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No saved simulations yet. Run one in the Decision Simulator and select Save simulation.</div>'}</section>`, 'Saved Simulations');
  document.querySelectorAll('[data-open]').forEach(b => {
    b.onclick = () => {
      const s = sims.find(x => x.id == b.dataset.open);
      if (!s) return;
      state.last = s.data.decision || null; state.lastAlt = s.data.alternative || null;
      state.result = s.data.result && s.data.result.deltas ? s.data.result : null;
      if (!state.result) toast('This older simulation was saved before the upgrade. Its inputs are loaded; run it again.');
      location.hash = '/simulator';
    };
  });
  document.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => { if (confirm('Delete this saved simulation?')) { Store.deleteSim(+b.dataset.del); toast('Deleted.'); saved(); } };
  });
}

function activity() {
  const a = (Store.get().activity || []).slice().reverse();
  shell(`<section class="card"><div class="section-head"><h2>Activity</h2>${a.length ? '<button class="btn small" id="clearAct">Clear log</button>' : ''}</div>${a.length ? a.map(i => `<div class="insight">${esc(i.text)} <span class="muted">${new Date(i.time).toLocaleString('en-IN')}</span></div>`).join('') : '<div class="empty">No activity recorded yet.</div>'}</section>`, 'Activity');
  const b = $('#clearAct');
  if (b) b.onclick = () => { if (confirm('Clear the activity log?')) { const s = Store.get(); s.activity = []; Store.set(s); activity(); } };
}

function settings() {
  shell(`<section class="card"><h2>Privacy</h2><p class="muted">Your information stays in this browser's localStorage. The Java server runs on your computer, only calculates, and never writes your financial data to disk.</p></section>
  <section class="card section"><h2>Your data</h2><div class="row"><button class="btn" id="demoBtn">Load demo data</button><button class="btn" id="exportBtn">Export my data (JSON)</button><button class="btn danger" id="reset">Reset all local data</button></div></section>`, 'Settings');
  $('#demoBtn').onclick = () => { if (!Store.profile().income || confirm('Replace your current profile with demo data?')) { Store.demo(); toast('Demo data loaded.'); location.hash = '/dashboard'; } };
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'finsight-data.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#reset').onclick = () => { if (confirm('Reset all local FinSight data?')) { localStorage.removeItem('finsight'); state.result = null; state.last = null; state.lastAlt = null; toast('Local data reset.'); location.hash = '/dashboard'; } };
}

/* ---------- Router ---------- */
function render() {
  const p = Store.profile(), r = state.route;
  if (r === 'dashboard') return dashboard(p);
  if (r === 'profile') return profilePage(p);
  if (r === 'simulator') return simulator(p);
  if (DATA_PAGES[r]) return dataPage(r, p);
  if (r === 'saved') return saved();
  if (r === 'activity') return activity();
  if (r === 'settings') return settings();
  location.hash = '/dashboard';
}

window.addEventListener('resize', () => draw());
route();