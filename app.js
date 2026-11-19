'use strict';
const $ = s => document.querySelector(s)
  , $$ = s => [...document.querySelectorAll(s)]
  , esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));
const initial = {
    demo: true,
    kpis: [{
        id: 'calls',
        name: 'Qualified calls',
        weight: 5
    }, {
        id: 'leads',
        name: 'Qualified leads',
        weight: 10
    }, {
        id: 'meetings',
        name: 'Meetings completed',
        weight: 20
    }, {
        id: 'applications',
        name: 'Applications completed',
        weight: 25
    }, {
        id: 'approvals',
        name: 'Approvals secured',
        weight: 50
    }, {
        id: 'deliverables',
        name: 'Deliverables accepted',
        weight: 30
    }],
    fighters: [{
        id: 'f1',
        name: 'Malak Hassan',
        function: 'B2C'
    }, {
        id: 'f2',
        name: 'Omar Khaled',
        function: 'oGV'
    }, {
        id: 'f3',
        name: 'Jana Ahmed',
        function: 'iGV'
    }, {
        id: 'f4',
        name: 'Youssef Ali',
        function: 'BD'
    }, {
        id: 'f5',
        name: 'Farida Tarek',
        function: 'TM'
    }, {
        id: 'f6',
        name: 'Ahmed Mostafa',
        function: 'oGT'
    }, {
        id: 'f7',
        name: 'Nour Mahmoud',
        function: 'B2C'
    }, {
        id: 'f8',
        name: 'Salma Ibrahim',
        function: 'iGV'
    }],
    results: []
};
const quantities = [[14, 8, 3, 4, 2, 2], [12, 6, 4, 3, 2, 2], [10, 7, 3, 4, 1, 2], [9, 5, 5, 2, 1, 2], [8, 4, 2, 3, 1, 3], [11, 3, 2, 2, 1, 2], [7, 5, 2, 2, 1, 1], [5, 4, 2, 1, 1, 2]];
quantities.forEach( (qs, i) => qs.forEach( (q, j) => {
    let a = Math.ceil(q * .6);
    initial.results.push({
        id: `d${i}-${j}a`,
        fighter: `f${i + 1}`,
        kpi: initial.kpis[j].id,
        quantity: a,
        day: '19'
    });
    if (q - a)
        initial.results.push({
            id: `d${i}-${j}b`,
            fighter: `f${i + 1}`,
            kpi: initial.kpis[j].id,
            quantity: q - a,
            day: '20'
        });
}
));
/* ---------- Backend (Google Sheets via Apps Script) ---------- */
// Paste the Apps Script Web App URL (ends in /exec). Leave '' to run local-only like before.
const API_URL = 'https://script.google.com/macros/s/AKfycbxkJke-IToJy1M0WcXPCGISs14_3rFTcrQBjpka9d20iwDvvjEr_hGtx-dOsAifpF-e/exec';
const POLL_MS = 20000;
const REMOTE = !!API_URL;
const CACHE_KEY = 'asfc-arena-cache-v1', QUEUE_KEY = 'asfc-arena-queue-v1', TS_KEY = 'asfc-arena-ts';
let myFighter = '';
try {
    myFighter = localStorage.getItem('asfc-my-fighter') || '';
} catch {}
;const clone = o => JSON.parse(JSON.stringify(o))
  , KEY = 'asfc-arena-v1';
let state = REMOTE ? {
    demo: false,
    kpis: [],
    fighters: [],
    results: []
} : clone(initial)
  , day = 'all'
  , view = 'arena';
try {
    let stored = localStorage.getItem(REMOTE ? CACHE_KEY : KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        if (valid(parsed))
            state = parsed;
    }
} catch {}
;function valid(s) {
    if (!s || typeof s.demo !== 'boolean' || !Array.isArray(s.kpis) || !Array.isArray(s.fighters) || !Array.isArray(s.results))
        return false;
    const ids = a => new Set(a.map(x => x.id)).size === a.length;
    return ids(s.kpis) && ids(s.fighters) && ids(s.results) && s.kpis.every(k => typeof k.id === 'string' && typeof k.name === 'string' && k.name.trim() && Number.isFinite(k.weight) && k.weight >= 0) && s.fighters.every(f => typeof f.id === 'string' && typeof f.name === 'string' && f.name.trim() && typeof f.function === 'string') && s.results.every(r => typeof r.id === 'string' && s.fighters.some(f => f.id === r.fighter) && s.kpis.some(k => k.id === r.kpi) && Number.isInteger(r.quantity) && r.quantity > 0 && ['19', '20', '21', '22'].includes(r.day));
}
const initials = n => n.trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const format = n => n.toLocaleString('en-US', {
    maximumFractionDigits: 2
});

/* ---------- Function-restricted KPIs ----------
   A KPI with a function (KPIs sheet, column E) can only be earned by fighters of that function.
   Blank = open to everyone. Several functions can be separated by , ; / or | */
const normFn = s => String(s || '').trim().toLowerCase();
const kpiFns = k => String(k.function || '').split(/[,;/|]/).map(normFn).filter(Boolean);
const canEarn = (f, k) => { const fns = kpiFns(k); return !fns.length || fns.includes(normFn(f.function)); };
const kpisFor = f => state.kpis.filter(k => canEarn(f, k));
let adminFighter = '';
function kpiTags(f, cls = '') {   // the specific KPIs a fighter has achieved in the selected period
    const by = new Map();
    selectedResults().filter(r => r.fighter === f.id).forEach(r => by.set(r.kpi, (by.get(r.kpi) || 0) + r.quantity));
    const tags = state.kpis.filter(k => by.has(k.id)).map(k => `<span class="kpi-tag">${esc(k.name)} <b>×${by.get(k.id)}</b></span>`).join('');
    return `<div class="kpi-tags ${cls}">${tags || '<span class="kpi-none">—</span>'}</div>`;
}
const kpiOptions = f => (f ? kpisFor(f) : state.kpis).map(k => `<option value="${esc(k.id)}">${esc(k.name)} (${format(k.weight)})</option>`).join('') || '<option value="" disabled selected>No KPIs for this function</option>';


/* ---------- Planning & PvA ----------
   Plans are typed in the Control room (Plan tab) and kept in state.plans = { "APL OGV": 120, … }.
   The plan STRUCTURE (which functions, which KPIs) is editable in Control room → Plan → Functions & KPIs
   and kept in state.planDef = [{ fn: 'OGV', kpis: ['APL','ACC','APD'] }, …]  (DEFAULT_PLAN_DEF until edited).
   Achieved is never typed: it is the sum of result quantities recorded under the matching scoring KPI.
   A scoring KPI counts toward a plan KPI when its name has the same words as the plan label ("APL OGV"),
   or when it is named like the type ("APL") and restricted to that function (OGV).            */
const DEFAULT_PLAN_DEF = [
    { fn: 'OGV',  kpis: ['APL', 'ACC', 'APD'] },
    { fn: 'IGV',  kpis: ['SC VIS', 'VIS', 'SLOT', 'APL', 'ACC', 'APD'] },
    { fn: 'OGTa', kpis: ['APL', 'ACC', 'APD'] },
    { fn: 'OGTe', kpis: ['APL', 'ACC', 'APD'] },
    { fn: 'IGTa', kpis: ['SC VIS', 'VIS', 'SLOT', 'APL', 'ACC', 'APD'] },
    { fn: 'IGTe', kpis: ['SC VIS', 'VIS', 'SLOT', 'APL', 'ACC', 'APD'] },
    { fn: 'B2C',  kpis: ['SC VIS', 'VIS', 'DEAL DONE', 'BTP', 'APL', 'APD'] },
    { fn: 'BD',   kpis: ['SC VISIT', 'VISIT', 'MONEY 1K'] }
];
const cleanPlanDef = d => {
    const seen = new Set(), out = [];
    (Array.isArray(d) ? d : []).forEach(g => {
        const fn = String((g && g.fn) || '').trim().slice(0, 20);
        if (!fn || seen.has(fn.toLowerCase())) return;
        seen.add(fn.toLowerCase());
        const ks = [], sk = new Set();
        (Array.isArray(g.kpis) ? g.kpis : []).forEach(k => {
            k = String(k || '').trim().slice(0, 20);
            if (k && !sk.has(k.toLowerCase())) { sk.add(k.toLowerCase()); ks.push(k); }
        });
        out.push({ fn, kpis: ks });
    });
    return out.slice(0, 20);
};
const planDef = () => Array.isArray(state.planDef) ? cleanPlanDef(state.planDef) : DEFAULT_PLAN_DEF;
let planMode = 'targets';
function setPlanDef(next) {
    next = cleanPlanDef(next);
    const keep = new Set(next.flatMap(g => g.kpis.map(t => `${t} ${g.fn}`)));
    const P = state.plans || {};
    Object.keys(P).forEach(k => { if (!keep.has(k)) delete P[k]; });   // drop targets of removed KPIs
    state.plans = P;
    state.planDef = next;
    try { persistLocal(); } catch {}
    render();
    renderAdmin();
    adminSay(REMOTE ? 'Saving plan structure…' : 'Plan structure saved.');
    markPlans();
}
const LC_GROUP = { 'SC VISIT': 'SC VIS', 'VISIT': 'VIS' };   // BD's visit KPIs roll up into the LC visit lines
const LC_BASE = ['SC VIS', 'VIS', 'SLOT', 'DEAL DONE', 'BTP', 'APL', 'ACC', 'APD', 'MONEY 1K'];   // preferred order of the LC total rows; new KPI types are appended
const PLANS_DIRTY_KEY = 'asfc-plans-dirty';
let plansDirty = false, plansBusy = false, plansUnsupported = false;
try { plansDirty = localStorage.getItem(PLANS_DIRTY_KEY) === '1'; } catch {}
const cleanPlans = p => { const o = {}; if (p && typeof p === 'object') for (const [k, v] of Object.entries(p)) { const n = Number(v); if (v !== '' && v != null && Number.isFinite(n) && n >= 0) o[k] = n; } return o; };
function planModel() {
    const nm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tok = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');   // word order doesn't matter: "OGV APL" = "APL OGV"
    const qty = new Map();
    state.results.forEach(r => qty.set(r.kpi, (qty.get(r.kpi) || 0) + r.quantity));
    const P = state.plans || {};
    const def = planDef();
    const groups = def.map(g => ({
        fn: g.fn,
        rows: g.kpis.map(type => {
            const label = `${type} ${g.fn}`, L = tok(label), T = nm(type), F = nm(g.fn);
            const ks = state.kpis.filter(k => tok(k.name) === L || (nm(k.name) === T && kpiFns(k).map(nm).includes(F)));
            return { label, type, plan: Number(P[label]) || 0, ach: ks.reduce((n, k) => n + (qty.get(k.id) || 0), 0), matched: ks.length > 0 };
        })
    }));
    const types = [...new Set(def.flatMap(g => g.kpis.map(t => LC_GROUP[t] || t)))];
    const order = [...LC_BASE.filter(t => types.includes(t)), ...types.filter(t => !LC_BASE.includes(t))];
    const lcMap = new Map(order.map(t => [t, { label: t, plan: 0, ach: 0 }]));
    groups.forEach(g => g.rows.forEach(r => { const t = lcMap.get(LC_GROUP[r.type] || r.type); t.plan += r.plan; t.ach += r.ach; }));
    return { groups, lc: [...lcMap.values()], missing: groups.flatMap(g => g.rows).filter(r => !r.matched).map(r => r.label) };
}
const pvaPct = (a, p) => p > 0 ? Math.round(a / p * 100) : null;
function pvaRow(label, plan, ach) {
    const pct = pvaPct(ach, plan);
    return `<div class="pva-row${pct != null && pct >= 100 ? ' hit' : ''}"><span class="pva-k">${esc(label)}</span><span class="pva-n">${plan ? format(plan) : '—'}</span><span class="pva-n"><b>${format(ach)}</b></span><span class="pva-p">${pct == null ? '—' : pct + '%'}</span><span class="pva-bar"><i style="width:${pct == null ? 0 : Math.min(100, pct)}%"></i></span></div>`;
}
const pvaHead = first => `<div class="pva-row pva-head"><span>${first}</span><span>PLAN</span><span>ACHIEVED</span><span>PvA</span></div>`;
function renderPva() {
    const box = $('#pva-content');
    if (!box) return;
    const m = planModel();
    const lc = `<article class="pva-card pva-lc"><div class="pva-title"><h3>LC TOTAL</h3><span class="eyebrow">ALL FUNCTIONS COMBINED</span></div>${pvaHead('KPI')}${m.lc.map(r => pvaRow(r.label, r.plan, r.ach)).join('')}</article>`;
    const cards = m.groups.map(g => {
        const plan = g.rows.reduce((n, r) => n + r.plan, 0);
        return `<article class="pva-card"><div class="pva-title"><h3>${esc(g.fn)}</h3><span class="eyebrow">${g.rows.filter(r => r.plan > 0 && r.ach >= r.plan).length} / ${g.rows.length} ON PLAN</span></div>${pvaHead('KPI')}${g.rows.map(r => pvaRow(r.type, r.plan, r.ach)).join('')}</article>`;
    }).join('');
    const none = !Object.values(state.plans || {}).some(v => v > 0);
    const miss = m.missing.length ? `<p class="pva-note">No scoring KPI is linked to: ${esc(m.missing.slice(0, 8).join(', '))}${m.missing.length > 8 ? ` and ${m.missing.length - 8} more` : ''}. Results only count toward Achieved when a KPI in the Control room has the same words as the plan KPI in any order (e.g. “APL OGV” or “OGV APL”), or is named “APL” and restricted to function OGV.</p>` : '';
    box.innerHTML = `${none ? '<p class="pva-note">No plan entered yet. Set targets in Control room → Plan.</p>' : ''}${lc}<div class="pva-grid">${cards}</div>${miss}`;
}
function markPlans() {
    plansDirty = true;
    try { localStorage.setItem(PLANS_DIRTY_KEY, '1'); } catch {}
    plansUnsupported = false;
    pushPlans();
}
async function pushPlans() {
    if (!REMOTE || !plansDirty || plansBusy || !getToken()) return;
    plansBusy = true;
    try {
        const r = await post('setPlans', { plans: cleanPlans(state.plans), planDef: planDef() });
        if (r && r.ok) {
            plansDirty = false;
            try { localStorage.removeItem(PLANS_DIRTY_KEY); } catch {}
            adminSay('Plan saved and synced to every device.');
        } else if (r && r.error === 'unauthorized') {
            setSync('auth');
        } else {
            plansUnsupported = true;
            adminSay('Plan saved on this device only. The server does not store plans yet (needs the Apps Script update).');
        }
    } catch { /* offline: retried on the next tick */ }
    finally { plansBusy = false; }
}

/* ---------- Identity: fighter numbers, tiers, damage, first night, most improved ---------- */
const fno = f => String(state.fighters.findIndex(x => x.id === (typeof f === 'string' ? f : f.id)) + 1).padStart(3, '0');   // 001, 002… in sheet order
const TIERS = [['SPECTATOR', 0], ['RECRUIT', 1], ['BRAWLER', 100], ['VETERAN', 300], ['LEGEND', 600]];   // [name, overall points needed]
let _tot = null, _meta = null;                                  // both reset at the top of render()
const totals = () => _tot || (_tot = state.results.reduce((m, r) => m.set(r.fighter, (m.get(r.fighter) || 0) + points(r)), new Map()));
const tierIdx = p => TIERS.reduce((a, t, i) => p >= t[1] ? i : a, 0);
const tierOf = id => tierIdx(totals().get(id) || 0);
const scuffs = id => { const t = tierOf(id); return t ? `<span class="scuffs" data-t="${t}" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i></span>` : ''; };
function standings(upto) {
    const pts = new Map(state.fighters.map(f => [f.id, 0]));
    state.results.forEach(r => { if (r.day <= upto && pts.has(r.fighter)) pts.set(r.fighter, pts.get(r.fighter) + points(r)); });
    const order = [...pts].sort((a, b) => b[1] - a[1]), rank = new Map();
    order.forEach(([id, p], i) => rank.set(id, i && p === order[i - 1][1] ? rank.get(order[i - 1][0]) : i + 1));
    return { pts, rank };
}
function meta() {   // first = new on the board on the latest scored day · improved = biggest climb since the day before (soap pink)
    if (_meta) return _meta;
    const m = _meta = { first: new Set(), improved: '' };
    const days = ['19', '20', '21', '22'].filter(d => state.results.some(r => r.day === d));
    if (days.length < 2) return m;
    const last = days[days.length - 1], prev = days[days.length - 2], a = standings(prev), b = standings(last), seen = new Map();
    state.results.forEach(r => { if (!seen.has(r.fighter) || r.day < seen.get(r.fighter)) seen.set(r.fighter, r.day); });
    const dp = (id, d) => state.results.filter(r => r.fighter === id && r.day === d).reduce((n, r) => n + points(r), 0);
    let best = null;
    state.fighters.forEach(f => {
        if (seen.get(f.id) === last) { m.first.add(f.id); return; }
        const gain = a.rank.get(f.id) - b.rank.get(f.id), before = dp(f.id, prev), growth = before ? dp(f.id, last) / before : 0;
        if (gain <= 0 && growth <= 1) return;
        if (!best || gain > best.gain || (gain === best.gain && growth > best.growth)) best = { id: f.id, gain, growth };
    });
    if (best) m.improved = best.id;
    return m;
}
const chips = id => `${meta().first.has(id) ? '<span class="chip fn">FIRST NIGHT</span>' : ''}${meta().improved === id ? '<span class="chip wild">MOST IMPROVED</span>' : ''}`;
function renderRules() {   // Fight Club numbering: 01 show up · 02 no spectators · KPIs · first night
    const pad = x => String(x).padStart(2, '0'), last = state.kpis.length + 3, names = state.fighters.filter(f => meta().first.has(f.id)).map(f => f.name);
    const nav = $('#nav-rules'); if (nav) nav.textContent = `Rules 01—${pad(last)}`;
    $('#rule-cards').innerHTML = `<article class="rule-card"><p class="eyebrow">RULE 01</p><h3>SHOW UP. DO THE WORK.</h3><p class="rule-text">Recognition is earned here.</p></article>`
        + `<article class="rule-card rule-quiet"><p class="eyebrow">RULE 02</p><h3>YOU DO NOT TALK ABOUT THE ARENA.</h3><p class="rule-text">Everyone here is on the board. Nobody watches from the side.</p><span class="ribbon">NO SPECTATORS</span></article>`
        + (state.kpis.map((k, i) => `<article class="rule-card"><p class="eyebrow">RULE ${pad(i + 3)}</p><h3>${esc(k.name)}</h3><small class="rule-fn">${k.function ? esc(k.function) : 'ALL FUNCTIONS'}</small><strong>${format(k.weight)}</strong> <small>PTS / RESULT</small></article>`).join('') || '<p class="empty">Add your first KPI in the control room.</p>')
        + `<article class="rule-card rule-first"><p class="eyebrow">RULE ${pad(last)}</p><h3>IF THIS IS YOUR FIRST NIGHT, YOU HAVE TO FIGHT.</h3><p class="rule-text">${names.length ? `New on the board tonight: ${esc(names.join(', '))}.` : 'Land your first verified result and the badge is yours.'}</p><span class="fn-seal"><b>FIRST</b><b>NIGHT</b></span></article>`;
}

/* ---------- Photos ---------- */
function photoUrls(u) {   // [primary, fallback]
    u = String(u || '').trim();
    if (!/^https:\/\//i.test(u)) return [];
    const m = u.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
    return m ? [`https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`, `https://lh3.googleusercontent.com/d/${m[1]}=w400`] : [u];   // normal Drive share links just work
}
const photoSrc = u => photoUrls(u)[0] || '';
const IMG_ERR = "if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt')}else{console.warn('Photo failed to load:',this.src);this.remove()}";
function imgTag(f, cls, size) {
    const [src, alt] = photoUrls(f.photo_url);
    if (!src) return '';
    return `<img ${cls ? `class="${cls}" ` : ''}src="${esc(src)}" ${alt ? `data-alt="${esc(alt)}" ` : ''}data-key="${esc(src)}" alt="${esc(f.name)}" loading="lazy" referrerpolicy="no-referrer" width="${size}" height="${size}" onerror="${IMG_ERR}">`;
}
function avatar(f, cls = 'mini-avatar') {
    return `<span class="${cls}" title="${TIERS[tierOf(f.id)][0]}">${esc(initials(f.name))}${imgTag(f, '', 40)}${scuffs(f.id)}</span>`;
}
function renderLeaderPhoto(lead) {
    const init = $('#leader-initials'), art = init && init.closest('.fighter-art');
    if (!art) return;
    const [src, alt] = lead ? photoUrls(lead.photo_url) : [];
    let box = art.querySelector('.leader-photo');
    if (!src) { if (box) box.remove(); art.classList.remove('has-photo'); return; }
    if (!box) { box = document.createElement('div'); box.className = 'leader-photo'; art.prepend(box); }
    const img = box.querySelector('img');
    if (!img || img.dataset.key !== src)
        box.innerHTML = `<img src="${esc(src)}" ${alt ? `data-alt="${esc(alt)}" ` : ''}data-key="${esc(src)}" alt="${esc(lead.name)}" referrerpolicy="no-referrer" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.removeAttribute('data-alt')}else{console.warn('Photo failed to load:',this.src);this.closest('.fighter-art').classList.remove('has-photo');this.closest('.leader-photo').remove()}">`;
    art.classList.add('has-photo');
}
function photoTag(f) {
    return imgTag(f, 'fighter-photo', 88);
}
const portrait = (f, extra = '') => `<span class="portrait ${extra}"><span class="p-frame"><b class="p-init">${esc(initials(f.name))}</b>${imgTag(f, 'fighter-photo', 120)}${scuffs(f.id)}</span>${extra ? '<i class="clip"></i>' : ''}</span>`;

/* ---------- Function boards (leaderboard per function) ---------- */
let fnSel = '';
const fnKey = f => (f.function || '').trim().toUpperCase() || 'OTHER';
function ensureFnBoard() {
    let sec = $('#fn-board');
    if (sec) return sec;
    const table = $('#rankings') && $('#rankings').closest('table');
    if (!table) return null;
    const anchor = table.closest('section') || table.parentElement;
    const wrapClass = table.parentElement !== anchor ? table.parentElement.className : '';
    const periodBtn = $('#periods button');
    sec = document.createElement('section');
    sec.id = 'fn-board';
    sec.className = anchor.tagName === 'SECTION' ? anchor.className : '';
    sec.dataset.tabClass = periodBtn ? periodBtn.className.replace(/\bselected\b/g, '').trim() : '';
    sec.dataset.tabsWrap = $('#periods') ? $('#periods').className : 'tabs';
    sec.innerHTML = '<div class="board-heading"><div><p class="eyebrow" id="fn-period"></p><h2>FUNCTION BOARDS.</h2></div></div><div id="fn-tabs" role="tablist"></div>'
        + `<div class="${esc(wrapClass)}"><table class="${esc(table.className)}">${table.querySelector('thead') ? table.querySelector('thead').outerHTML : ''}<tbody id="fn-rankings"></tbody></table></div>`;
    anchor.insertAdjacentElement('afterend', sec);
    $('#fn-tabs').className = sec.dataset.tabsWrap;
    $('#fn-tabs').addEventListener('click', e => {
        const b = e.target.closest('[data-fn]');
        if (!b) return;
        fnSel = b.dataset.fn;
        renderFunctionBoard();
    });
    return sec;
}
function renderFunctionBoard(rows = ranked()) {
    const sec = ensureFnBoard();
    if (!sec) return;
    const keys = [...new Set(rows.map(fnKey))].sort();
    sec.hidden = !keys.length;
    if (!keys.length) return;
    if (!keys.includes(fnSel)) fnSel = keys[0];
    const cls = sec.dataset.tabClass;
    $('#fn-period').textContent = day === 'all' ? 'ALL FOUR DAYS' : `DAY ${Number(day) - 18}`;
    $('#fn-tabs').innerHTML = keys.map(k => {
        const total = rows.filter(f => fnKey(f) === k).reduce((n, f) => n + f.points, 0);
        return `<button type="button" class="${cls}${k === fnSel ? ' selected' : ''}" role="tab" aria-selected="${k === fnSel}" data-fn="${esc(k)}">${esc(k)}<span class="fn-total">${format(total)}</span></button>`;
    }).join('');
    let rank = 0;
    const list = rows.filter(f => fnKey(f) === fnSel).map((f, i, a) => {
        if (i === 0 || f.points !== a[i - 1].points) rank = i + 1;
        return { ...f, frank: rank, gap: i ? a[i - 1].points - f.points : 0, first: i === 0 };
    });
    $('#fn-rankings').innerHTML = list.map(f => `<tr class="${f.frank === 1 ? 'first-row' : ''}" tabindex="0" role="button" aria-label="View ${esc(f.name)} scorecard" data-fighter="${esc(f.id)}"><td>${String(f.frank).padStart(2, '0')}</td><td><div class="fighter-cell">${avatar(f)}<div><b>${esc(f.name)}</b><small>OVERALL #${String(f.rank).padStart(2, '0')} · FIGHTER ${fno(f)}</small>${kpiTags(f, 'in-fighter')}</div></div></td><td><span class="func-tag">${esc(f.function)}</span></td><td><b>${format(f.quantity)}</b>${kpiTags(f)}</td><td><data class="cnt" value="${f.points}" data-key="fn:${esc(f.id)}">${format(f.points)}</data></td><td>${f.frank === 1 ? 'THE LEAD' : f.gap === 0 ? 'TIED' : `${format(f.gap)} PTS`}</td><td>↗</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No fighters in this function.</td></tr>';
    runCounts($('#fn-rankings'));
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout( () => $('#toast').classList.remove('visible'), 3300);
}
function persistLocal() {
    localStorage.setItem(REMOTE ? CACHE_KEY : KEY, JSON.stringify(state));
}
function save(message) {
    try {
        persistLocal();
        if (message)
            toast(message);
    } catch {
        toast('Browser storage is unavailable. Export a backup to keep changes.');
    }
    render();
}
function points(r) {
    return r.quantity * (state.kpis.find(k => k.id === r.kpi)?.weight || 0);
}
function selectedResults() {
    return state.results.filter(r => day === 'all' || r.day === day);
}
function ranked() {
    const rows = state.fighters.map(f => {
        let results = selectedResults().filter(r => r.fighter === f.id);
        return {
            ...f,
            points: results.reduce( (a, r) => a + points(r), 0),
            quantity: results.reduce( (a, r) => a + r.quantity, 0)
        };
    }
    ).sort( (a, b) => b.points - a.points || a.name.localeCompare(b.name));
    let rank = 0;
    return rows.map( (f, i) => {
        if (i === 0 || f.points !== rows[i - 1].points)
            rank = i + 1;
        return {
            ...f,
            rank
        };
    }
    );
}
function render() {
    _tot = _meta = null;
    const rows = ranked()
      , lead = rows[0];
    $('.demo').innerHTML = `<i></i> ${state.demo ? 'DEMO ARENA' : REMOTE ? 'LIVE ARENA' : 'LOCAL ARENA'}`;
    $('.notice').hidden = !state.demo;
    setCount($('#total-fighters'), 'tf', state.fighters.length);
    setCount($('#total-points'), 'tp', rows.reduce( (n, f) => n + f.points, 0));
    $('#leader-name').textContent = lead?.name || 'YOUR SPOT AWAITS';
    $('#leader-function').textContent = lead?.function || 'THE ARENA IS OPEN';
    $('#leader-initials').textContent = lead ? initials(lead.name) : 'FC';
    renderLeaderPhoto(lead);
    const leadArt = $('.fighter-art'); leadArt.querySelector('.scuffs')?.remove(); if (lead) leadArt.insertAdjacentHTML('beforeend', scuffs(lead.id));
    $('#leader-number').textContent = lead ? fno(lead) : '—';
    setCount($('#leader-score'), 'leader', lead?.points || 0);
    $('#leader-lead').textContent = lead ? (rows[1] ? (lead.points === rows[1].points ? 'Tied for the lead. Every result matters.' : `${format(lead.points - rows[1].points)} points ahead of ${rows[1].name.split(' ')[0]}.`) : 'The first fighter in the arena.') : 'Add fighters in the control room to begin.';
    $('#leader-detail').disabled = !lead;
    $('#leader-detail').onclick = () => lead && showScore(lead.id);
    $('#pursuit').innerHTML = rows.slice(1, 3).map(f => `<div class="pursuer" role="button" tabindex="0" data-fighter="${esc(f.id)}"><span class="rank">${String(f.rank).padStart(2, '0')}</span>${avatar(f)}<div><strong>${esc(f.name)}</strong><small>№${fno(f)} · ${esc(f.function)} · ${format(lead.points - f.points)} off the lead</small></div><div class="p-points"><data class="cnt" value="${f.points}" data-key="pu:${esc(f.id)}">${format(f.points)}</data><small>PTS</small></div></div>`).join('') || '<p class="empty">The next challenger could be you.</p>';
    runCounts($('#pursuit'));
    const current = $('#function-filter').value;
    $('#function-filter').innerHTML = '<option value="all">All functions</option>' + [...new Set(state.fighters.map(f => f.function))].sort().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    if ([...$('#function-filter').options].some(x => x.value === current))
        $('#function-filter').value = current;
    renderIdentity();
    trackRanks(rows);
    renderRows(rows, true);
    renderFunctionBoard(rows);
    $('#activity').innerHTML = selectedResults().slice(-5).reverse().map(r => {
        let f = state.fighters.find(f => f.id === r.fighter)
          , k = state.kpis.find(k => k.id === r.kpi);
        return `<div class="activity-row"><span class="hit-icon">↗</span><div><p><b>${esc(f.name)}</b></p><small>№${fno(f)} · ${r.quantity} × ${esc(k.name)} · Day ${Number(r.day) - 18}</small></div><b>+${format(points(r))}</b></div>`;
    }
    ).join('') || '<p class="empty">No achievements recorded for this period.</p>';
    if (view === 'corner')
        renderCorner();
    renderRules();
    if (view === 'pva')
        renderPva();
    renderTicker();
    checkChampion();
    renderTV();
}
function renderRows(rows=ranked(), flip=false) {
    let query = $('#search').value.trim().toLowerCase()
      , func = $('#function-filter').value;
    let filtered = rows.filter(f => f.name.toLowerCase().includes(query) && (func === 'all' || f.function === func));
    $('#showing').textContent = `${filtered.length} OF ${rows.length} FIGHTERS · ${day === 'all' ? 'ALL FOUR DAYS' : `DAY ${Number(day) - 18}`}`;
    const tb = $('#rankings'), before = flip ? snapshotRows(tb) : null;
    tb.innerHTML = filtered.map(f => {
        let index = rows.findIndex(r => r.id === f.id)
          , gap = index ? rows[index - 1].points - f.points : 0
          , di = deltaInfo(f.id);
        return `<tr class="${f.rank === 1 ? 'first-row' : ''}${meta().improved === f.id ? ' improved' : ''}${di ? (di.d > 0 ? ' moved-up' : ' moved-down') : ''}"${di ? ` style="--age:${di.age}ms"` : ''} tabindex="0" role="button" aria-label="View ${esc(f.name)} scorecard" data-fighter="${esc(f.id)}"><td>${String(f.rank).padStart(2, '0')}${deltaBadge(di)}</td><td><div class="fighter-cell">${avatar(f)}<div><b>${esc(f.name)}</b><small>FIGHTER ${fno(f)} · ${TIERS[tierOf(f.id)][0]}</small>${chips(f.id)}${kpiTags(f, 'in-fighter')}</div></div></td><td><span class="func-tag">${esc(f.function)}</span></td><td><b>${format(f.quantity)}</b>${kpiTags(f)}</td><td><data class="cnt" value="${f.points}" data-key="t:${esc(f.id)}">${format(f.points)}</data></td><td>${f.rank === 1 ? 'THE LEAD' : gap === 0 ? 'TIED' : `${format(gap)} PTS`}</td><td>↗</td></tr>`;
    }
    ).join('') || '<tr><td colspan="7" class="empty">No fighters found.</td></tr>';
    runCounts(tb);
    if (before) playFlip(tb, before);
}
function showScore(id) {
    let f = ranked().find(x => x.id === id);
    if (!f)
        return;
    let rs = selectedResults().filter(r => r.fighter === id);
    const t = tierOf(id), period = day === 'all' ? 'OVERALL' : `DAY ${Number(day) - 18}`;
    const lines = kpisFor(f).map(k => {
        let q = rs.filter(r => r.kpi === k.id).reduce( (a, r) => a + r.quantity, 0);
        return `<div class="score-line"><span>${esc(k.name)}<br><small>${q} results × ${format(k.weight)} points</small></span><b>${format(q * k.weight)} PTS</b></div>`;
    }).join('');
    $('#scorecard-content').innerHTML = `<div class="dossier" data-tier="${t}"><div class="classified"><span>CLASSIFIED</span><span>CASE FILE №${fno(f)}</span></div><div class="d-top">${portrait(f, 'dossier')}<div class="d-id"><p class="d-label">SUBJECT</p><h2 class="score-name" data-type>${esc(f.name.toUpperCase())}</h2><p class="d-meta" data-type>${esc(f.function)} / RANK ${f.rank} / ${period}</p><p class="d-tags"><span class="belt">${TIERS[t][0]}</span>${chips(id)}</p></div></div><div class="score-total">${format(f.points)} <small>PTS</small></div><div class="d-lines">${lines}</div><p class="d-foot" data-type>PROJECT ARENA / NO SPECTATORS / EVERY POINT EARNED.</p></div>`;
    $('#scorecard').showModal();
    typeOut($('#scorecard-content'));
}
function setView(v) {
    view = v;
    $('#arena-view').hidden = v !== 'arena';
    $('#rules-view').hidden = v !== 'rules';
    $('#corner-view').hidden = v !== 'corner';
    $('#pva-view').hidden = v !== 'pva';
    if (v === 'corner')
        renderCorner();
    if (v === 'pva')
        renderPva();
    $$('.nav').forEach(b => b.classList.toggle('active', b.dataset.view === v));
}
$$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#see-rules').onclick = () => {
    setView('rules');
    window.scrollTo({
        top: 220,
        behavior: 'smooth'
    });
}
;
$('#periods').onclick = e => {
    let b = e.target.closest('[data-day]');
    if (!b)
        return;
    day = b.dataset.day;
    $$('[data-day]').forEach(x => x.classList.toggle('selected', x === b));
    render();
}
;
$('#search').oninput = () => renderRows();
$('#function-filter').onchange = () => renderRows();
document.addEventListener('click', e => {
    let f = e.target.closest('[data-fighter]');
    if (f)
        showScore(f.dataset.fighter);
}
);
document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-fighter]')) {
        e.preventDefault();
        showScore(e.target.dataset.fighter);
    }
        if (e.key === 'Escape' && TV.on && !document.querySelector('#takeover[open]'))
        setTV(false);
    if (TV.on && (e.key === 'l' || e.key === 'L') && !e.target.matches('input,select,textarea')) {
        const tb = $('#tv-theme'); if (tb) tb.click();   // L = toggle light/dark on the projector
    }
}
);
$$('.close').forEach(b => b.onclick = () => b.closest('dialog').close());
$$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            d.close();
    }
}
));
$('#projector').onclick = () => setTV(!TV.on);
function renderIdentity() {
    const select = $('#identity-select');
    select.innerHTML = '<option value="">Choose your fighter</option>' + state.fighters.map(f => `<option value="${esc(f.id)}">${fno(f)} · ${esc(f.name)}</option>`).join('');
    if (state.fighters.some(f => f.id === myFighter))
        select.value = myFighter;
    else
        myFighter = '';
}
function tier(p) {   // [name, points for the next tier | null, index]
    const i = tierIdx(p);
    return [TIERS[i][0], TIERS[i + 1] ? TIERS[i + 1][1] : null, i];
}
function renderCorner() {
    const f = ranked().find(f => f.id === myFighter)
      , box = $('#corner-content');
    if (!f) {
        box.innerHTML = '<div class="corner-empty"><span class="eyebrow">STEP INTO THE RING</span><h3>EVERY FIGHT<br>NEEDS A NAME.</h3><p>Choose your fighter from the arena to unlock your personal scorecard.</p><button class="primary" id="choose-fighter">Choose my fighter ↗</button></div>';
        $('#choose-fighter').onclick = () => {
            setView('arena');
            $('#identity-select').focus();
            $('#identity-select').scrollIntoView({
                block: 'center',
                behavior: 'smooth'
            });
        }
        ;
        return;
    }
    const rows = ranked()
      , index = rows.findIndex(r => r.id === f.id)
      , rival = index > 0 ? rows[index - 1] : null
      , level = tier(totals().get(f.id) || 0)
      , rs = selectedResults().filter(r => r.fighter === f.id)
      , gap = rival ? rival.points - f.points + 1 : 0;
    box.innerHTML = `<div class="corner-top"><div class="corner-id">${portrait(f)}<span class="eyebrow">${esc(f.function)} / FIGHTER ${fno(f)}</span><h2>${esc(f.name.toUpperCase())}</h2><span class="belt">${level[0]}</span>${chips(f.id)}<p>${level[1] != null ? `Next tier: ${TIERS[level[2] + 1][0]} at ${level[1]} points` : 'Top tier. Nobody climbs higher.'}</p></div><div class="corner-number"><span>RANK</span><b>${String(f.rank).padStart(2, '0')}</b></div><div class="corner-number"><span>POINTS</span><b>${format(f.points)}</b></div></div><div class="corner-grid"><article class="rival-card"><p class="eyebrow">${rival ? 'YOUR NEXT TARGET' : 'DEFEND THE TOP SPOT'}</p><h3>${rival ? esc(rival.name.toUpperCase()) : 'THEY ARE<br>COMING FOR YOU.'}</h3><p>${rival ? `Earn <b>${format(gap)} more points</b> to take the next position.` : 'You hold the lead. Keep adding verified results to extend it.'}</p><div class="progress-track"><i style="width:${rival ? Math.min(100, 100 * f.points / (rival.points + 1)) : 100}%"></i></div><small>${format(f.points)} / ${rival ? format(rival.points + 1) : 'THE LEAD'}</small></article><article class="mission-card"><p class="eyebrow">MAKE YOUR NEXT MOVE</p><h3>${rival ? 'CLOSE THE GAP.' : 'RAISE THE BAR.'}</h3><p>Possible next moves using current KPI weights.</p>${kpisFor(f).filter(k => k.weight > 0).slice().sort( (a, b) => b.weight - a.weight).slice(0, 3).map(k => `<div class="mission-line"><b>${Math.ceil((gap || 50) / k.weight)}×</b><span>${esc(k.name)}<small>${format(k.weight)} points each</small></span><span>↗</span></div>`).join('') || '<p>No scoring KPIs are set up for your function yet.</p>'}<small class="mission-note">Suggestions only. Results must be verified.</small></article></div><section class="personal-history"><div class="panel-heading"><h3>YOUR FOUR ROUNDS.</h3><span class="eyebrow">POINTS BY DAY / ALL DAYS</span></div><div class="round-bars">${['19', '20', '21', '22'].map( (d, i) => {
        let n = state.results.filter(r => r.fighter === f.id && r.day === d).reduce( (a, r) => a + points(r), 0)
          , max = Math.max(1, ...['19', '20', '21', '22'].map(x => state.results.filter(r => r.fighter === f.id && r.day === x).reduce( (a, r) => a + points(r), 0)));
        return `<div><span>DAY 0${i + 1}</span><div class="round-bar"><i style="height:${Math.max(2, n / max * 100)}%"></i></div><b>${format(n)}</b></div>`;
    }
    ).join('')}</div></section>`;
}
function compareRender() {
    let a = ranked().find(f => f.id === $('#compare-a').value)
      , b = ranked().find(f => f.id === $('#compare-b').value);
    if (!a || !b) {
        $('#comparison').innerHTML = '<p class="helper">Add at least two fighters to compare them.</p>';
        return;
    }
    $('#comparison').innerHTML = `<div class="compare-scores"><div><b>${format(a.points)}</b><span>RANK ${a.rank} · №${fno(a)}</span></div><span>VS</span><div><b>${format(b.points)}</b><span>RANK ${b.rank} · №${fno(b)}</span></div></div><p class="compare-verdict">${a.points === b.points ? 'DEAD EVEN. NEXT RESULT DECIDES.' : `${esc((a.points > b.points ? a : b).name.toUpperCase())} LEADS BY ${format(Math.abs(a.points - b.points))}.`}</p><p class="eyebrow">${day === 'all' ? 'OVERALL' : `DAY ${Number(day) - 18}`} / POINTS BY KPI</p>${state.kpis.filter(k => canEarn(a, k) || canEarn(b, k)).map(k => {
        let score = f => selectedResults().filter(r => r.fighter === f.id && r.kpi === k.id).reduce( (n, r) => n + points(r), 0)
          , x = score(a)
          , y = score(b);
        return `<div class="comparison-row"><b class="${x > y ? 'winning' : ''}">${canEarn(a, k) ? format(x) : '—'}</b><span>${esc(k.name)}</span><b class="${y > x ? 'winning' : ''}">${canEarn(b, k) ? format(y) : '—'}</b></div>`;
    }
    ).join('')}`;
}
$('#compare-open').onclick = () => {
    const rows = ranked()
      , opts = rows.map(f => `<option value="${esc(f.id)}">${fno(f)} · ${esc(f.name)}</option>`).join('');
    $('#compare-a').innerHTML = opts;
    $('#compare-b').innerHTML = opts;
    if (rows.length > 1)
        $('#compare-b').value = rows[1].id;
    if (myFighter) {
        $('#compare-a').value = myFighter;
        if ($('#compare-b').value === myFighter)
            $('#compare-b').value = rows.find(f => f.id !== myFighter)?.id || myFighter;
    }
    compareRender();
    $('#compare').showModal();
}
;
$('#compare-a').onchange = compareRender;
$('#compare-b').onchange = compareRender;
$('#identity-select').onchange = e => {
    myFighter = e.target.value;
    try {
        localStorage.setItem('asfc-my-fighter', myFighter);
    } catch {}
    ;toast(myFighter ? 'Your corner is ready.' : 'Fighter selection cleared.');
}
;
$('#open-corner').onclick = () => {
    setView('corner');
    $('#corner-view').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}
;
function countdown() {
    let now = Date.now()
      , start = Date.parse('2026-11-19T00:00:00+02:00')
      , end = Date.parse('2026-11-23T00:00:00+02:00');
    if (now < start) {
        let diff = Date.parse('2026-11-19T00:00:00+02:00') - now
          , days = Math.max(0, Math.floor(diff / 86400000))
          , hours = Math.max(0, Math.floor(diff % 86400000 / 3600000));
        $('#countdown-label').textContent = 'THE BOOTCAMP APPROACHES';
        $('#countdown-value').textContent = `${days}D : ${String(hours).padStart(2, '0')}H`;
        $('#countdown-note').textContent = 'Until 19 Nov · Cairo time';
    } else if (now < end) {
        $('#countdown-label').textContent = 'THE BOOTCAMP IS ON';
        $('#countdown-value').textContent = `DAY 0${Math.min(4, Math.floor((now - Date.parse('2026-11-19T00:00:00+02:00')) / 86400000) + 1)}`;
        $('#countdown-note').textContent = '19—22 November · Earn your place';
    } else {
        $('#countdown-label').textContent = 'FOUR DAYS. ALL IN.';
        $('#countdown-value').textContent = 'THE FINAL BELL';
        $('#countdown-note').textContent = 'Bootcamp concluded · View the final standings';
    }
}
/* ---------- Control room ---------- */
const PW_KEY = 'asfc-admin-pw', SESSION_KEY = 'asfc-admin-ok';
let adminTab = 'results', adminMsg = '';
const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};
/* ---------- Sync engine (only active when API_URL is set) ---------- */
const sync = { queue: [], busy: false, mode: 'ok', lastOk: Number(store_get(TS_KEY)) || 0, lastJson: '' };
function store_get(k) { try { return localStorage.getItem(k); } catch { return null; } }
try { sync.queue = JSON.parse(store_get(QUEUE_KEY) || '[]'); if (!Array.isArray(sync.queue)) sync.queue = []; } catch { sync.queue = []; }
function saveQueue() { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(sync.queue)); } catch {} }
function getToken() { try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } }
function ensureSyncBar() {
    let el = $('#sync-bar');
    if (!el) {
        document.head.insertAdjacentHTML('beforeend', '<style>#sync-bar{position:fixed;left:12px;bottom:12px;z-index:50;padding:6px 10px;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.85);color:#fff;border-left:3px solid #2bb673;pointer-events:none}#sync-bar.offline,#sync-bar.auth{border-left-color:#e5483a}body.projector #sync-bar{opacity:.6}</style>');
        document.body.insertAdjacentHTML('beforeend', '<div id="sync-bar" role="status" aria-live="polite">Loading scores…</div>');
        el = $('#sync-bar');
    }
    return el;
}
function setSync(mode) {
    if (!REMOTE) return;
    sync.mode = mode;
    const el = ensureSyncBar(), n = sync.queue.length;
    const t = sync.lastOk ? new Date(sync.lastOk).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '';
    el.className = mode;
    el.textContent = mode === 'ok' ? `Live · updated ${t}${n ? ` · ${n} syncing` : ''}`
        : mode === 'auth' ? `Session expired · unlock the control room to sync ${n} change${n === 1 ? '' : 's'}`
        : `Offline · showing last known scores${t ? ` (${t})` : ''}${n ? ` · ${n} change${n === 1 ? '' : 's'} waiting` : ''}`;
}
async function post(action, payload) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: getToken(), ...payload }), signal: ctl.signal });
        return await res.json();
    } finally { clearTimeout(timer); }
}
function enqueue(action, payload) {
    if (!REMOTE) return;
    sync.queue.push({ action, payload });
    saveQueue();
    setSync(sync.mode);
    flush();
}
async function flush() {
    if (!REMOTE || sync.busy || !sync.queue.length) return;
    sync.busy = true;
    let drained = false;
    try {
        while (sync.queue.length) {
            const op = sync.queue[0];
            let r;
            try { r = await post(op.action, op.payload); }
            catch { setSync('offline'); return; }                 // network down: keep the queue, retry on next tick
            if (r && r.ok) { sync.queue.shift(); saveQueue(); continue; }
            if (r && r.error === 'unauthorized') {
                try { sessionStorage.removeItem(SESSION_KEY); } catch {}
                setSync('auth');
                toast('Session expired. Unlock the control room again to sync.');
                return;
            }
            sync.queue.shift(); saveQueue();                      // rejected for good: drop it and roll back from the server
            toast('Server rejected a change (' + ((r && r.error) || 'error') + '). Reloading scores.');
        }
        drained = true;
    } finally { sync.busy = false; }
    if (drained) await pull();
}
async function pull() {
    if (!REMOTE) return;
    try {
        const res = await fetch(API_URL + '?t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        if (!data || !data.ok || !valid(data.state)) throw Error('bad payload');
        sync.lastOk = Date.now();
        try { localStorage.setItem(TS_KEY, String(sync.lastOk)); } catch {}
        setSync('ok');
        if (sync.queue.length) return;                            // never overwrite changes still waiting to sync
        const j = JSON.stringify(data.state);
        if (j !== sync.lastJson) {
            sync.lastJson = j;
            const keepPlans = state.plans, keepDef = state.planDef;
            state = data.state;
            state.plans = (plansDirty || !data.state.plans) ? (keepPlans || {}) : cleanPlans(data.state.plans);   // server plans win unless we have unsynced edits
            state.planDef = (plansDirty || !Array.isArray(data.state.planDef)) ? keepDef : data.state.planDef;   // same for the plan structure
            try { persistLocal(); } catch {}
            render();
        }
        liveReady = true;                                         // from now on a leader change is a real, live event
    } catch { setSync('offline'); }
}
function tick() {
    if (!REMOTE) return;
    if (plansDirty && !plansUnsupported && getToken()) pushPlans();
    if (sync.queue.length && getToken()) flush();
    else if (!document.hidden) pull();
}
const newId = (p, list) => { let id; do id = p + Math.random().toString(36).slice(2, 6); while (list.some(x => x.id === id)); return id; };
if (REMOTE) {
    ensureSyncBar();
    setSync('offline');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    setInterval(tick, POLL_MS);
    tick();
}


async function hashPw(s) {
    const text = 'asfc:' + s;
    if (crypto.subtle) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381;
    for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return 'x' + h;
}
function unlocked() {
    try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}
function cairoDay() {
    const d = new Date(Date.now() + 2 * 3600000).getUTCDate();
    return ['19', '20', '21', '22'].includes(String(d)) ? String(d) : '19';
}
function ensureAdminDialog() {
    if ($('#admin')) return;
    document.body.insertAdjacentHTML('beforeend', '<dialog id="admin"><div class="dialog-head"><p class="eyebrow red">CONTROL ROOM</p><button class="close" aria-label="Close control room">×</button></div><div id="admin-body"></div></dialog>');
    const d = $('#admin');
    d.querySelector('.close').onclick = () => d.close();
    d.addEventListener('click', adminClick);
    d.addEventListener('change', adminChange);
    d.addEventListener('submit', adminSubmit);
}
function adminSay(m) { adminMsg = m; const el = $('#admin-msg'); if (el) el.textContent = m; }
function renderAdmin() {
    const box = $('#admin-body');
    if (!box) return;
    const tabs = [['results', 'Results'], ['fighters', 'Fighters'], ['kpis', 'KPIs'], ['plan', 'Plan'], ['data', 'Data']];
    const selF = state.fighters.find(f => f.id === adminFighter) || state.fighters[0];
    const fOpts = state.fighters.map(f => `<option value="${esc(f.id)}"${selF && f.id === selF.id ? ' selected' : ''}>${fno(f)} · ${esc(f.name)} (${esc(f.function)})</option>`).join('');
    const kOpts = kpiOptions(selF);
    const dayOpts = ['19', '20', '21', '22'].map((d, i) => `<option value="${d}" ${d === cairoDay() ? 'selected' : ''}>Day 0${i + 1}</option>`).join('');
    let body = '';
    if (adminTab === 'results') {
        const list = state.results.slice().reverse().slice(0, 40).map(r => {
            const f = state.fighters.find(x => x.id === r.fighter), k = state.kpis.find(x => x.id === r.kpi);
            return `<div class="adm-row"><span><b>${esc(f.name)}</b><small>${r.quantity} × ${esc(k.name)} · Day ${Number(r.day) - 18}</small></span><b>+${format(points(r))}</b><button type="button" class="adm-x" data-act="del-result" data-id="${esc(r.id)}" aria-label="Delete result">×</button></div>`;
        }).join('') || '<p class="helper">No results yet.</p>';
        body = state.fighters.length && state.kpis.length
            ? `<form class="adm-form" data-form="result"><label>Fighter<select name="fighter" data-edit="result-fighter">${fOpts}</select></label><label>KPI<select name="kpi">${kOpts}</select></label><label>Qty<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Day<select name="day">${dayOpts}</select></label><button class="primary">Add result</button></form><h4>Latest 40 results</h4><div class="adm-list">${list}</div>`
            : '<p class="helper">Add at least one fighter and one KPI first.</p>';
    } else if (adminTab === 'fighters') {
        const fns = [...new Set(state.fighters.map(f => f.function))].map(x => `<option value="${esc(x)}">`).join('');
        body = `<form class="adm-form" data-form="fighter"><label>Name<input name="name" required maxlength="60"></label><label>Function<input name="function" list="fn-list" required maxlength="20"></label><label>Photo link<input name="photo_url" maxlength="500" placeholder="https://… (optional, Drive share link ok)"></label><datalist id="fn-list">${fns}</datalist><button class="primary">Add fighter</button></form><div class="adm-list">${state.fighters.map(f => `<div class="adm-row edit"><input data-edit="fighter-name" data-id="${esc(f.id)}" value="${esc(f.name)}" aria-label="Name"><input data-edit="fighter-fn" data-id="${esc(f.id)}" value="${esc(f.function)}" aria-label="Function" list="fn-list"><input data-edit="fighter-photo" data-id="${esc(f.id)}" value="${esc(f.photo_url || '')}" placeholder="Photo link (https://…)" aria-label="Photo link" maxlength="500"><button type="button" class="adm-x" data-act="del-fighter" data-id="${esc(f.id)}" aria-label="Remove fighter">×</button></div>`).join('') || '<p class="helper">No fighters yet.</p>'}</div>`;
    } else if (adminTab === 'kpis') {
        body = `<p class="helper">Changing a weight recalculates every score in the arena.</p><form class="adm-form" data-form="kpi"><label>KPI name<input name="name" required maxlength="60"></label><label>Points each<input name="weight" type="number" min="0" step="any" required></label><label>Function<input name="function" list="kfn-list" maxlength="40" placeholder="All functions"></label><datalist id="kfn-list">${[...new Set(state.fighters.map(f => f.function))].map(x => `<option value="${esc(x)}">`).join('')}</datalist><button class="primary">Add KPI</button></form><div class="adm-list">${state.kpis.map(k => `<div class="adm-row edit"><input data-edit="kpi-name" data-id="${esc(k.id)}" value="${esc(k.name)}" aria-label="KPI name"><input data-edit="kpi-weight" data-id="${esc(k.id)}" type="number" min="0" step="any" value="${k.weight}" aria-label="Weight"><input data-edit="kpi-fn" data-id="${esc(k.id)}" value="${esc(k.function || '')}" placeholder="All functions" aria-label="Function" list="kfn-list" maxlength="40"><button type="button" class="adm-x" data-act="del-kpi" data-id="${esc(k.id)}" aria-label="Remove KPI">×</button></div>`).join('') || '<p class="helper">No KPIs yet.</p>'}</div>`;
    } else if (adminTab === 'plan') {
        const P = state.plans || {}, def = planDef();
        const sub = `<div class="adm-tabs"><button type="button" class="${planMode === 'targets' ? 'selected' : ''}" data-act="plan-mode" data-id="targets">Targets</button><button type="button" class="${planMode === 'structure' ? 'selected' : ''}" data-act="plan-mode" data-id="structure">Functions &amp; KPIs</button></div>`;
        if (planMode === 'structure') {
            body = sub + `<p class="helper">One row per function, KPIs comma-separated (e.g. APL, ACC, APD). Renaming a function keeps its targets. Removing a KPI drops its target. A KPI counts Achieved when a scoring KPI in the KPIs tab has the same words ("APL OGV").</p><div class="adm-list">${def.map((g, i) => `<div class="adm-row edit"><input data-edit="pd-fn" data-i="${i}" value="${esc(g.fn)}" aria-label="Function" maxlength="20"><input data-edit="pd-kpis" data-i="${i}" value="${esc(g.kpis.join(', '))}" aria-label="KPIs"><button type="button" class="adm-x" data-act="pd-del" data-id="${i}" aria-label="Remove function">×</button></div>`).join('') || '<p class="helper">No functions yet.</p>'}</div><form class="adm-form" data-form="plandef"><label>New function<input name="fn" required maxlength="20"></label><label>KPIs<input name="kpis" placeholder="APL, ACC, APD"></label><button class="primary">Add function</button></form><div class="adm-actions"><button type="button" class="outline" data-act="pd-reset">Reset to defaults</button></div>`;
        } else {
            body = sub + `<p class="helper">Set each function's target for the whole bootcamp. Achieved is counted automatically from recorded results. Leave blank for no target.</p><div class="plan-admin">${def.map(g => `<fieldset class="plan-fs"><legend>${esc(g.fn)}</legend>${g.kpis.map(t => { const lab = `${t} ${g.fn}`; return `<label><span>${esc(t)}</span><input type="number" min="0" step="any" inputmode="decimal" data-edit="plan" data-key="${esc(lab)}" value="${P[lab] ?? ''}" placeholder="0"></label>`; }).join('')}</fieldset>`).join('') || '<p class="helper">Add a function in the Functions &amp; KPIs tab.</p>'}</div>`;
        }
    } else {
        body = `<p class="helper">${REMOTE ? 'Scores live in the shared Google Sheet and sync to every device. Export a backup before big changes.' : 'Everything is stored in this browser only. Export a backup before closing or switching devices.'}</p><div class="adm-actions"><button type="button" class="outline" data-act="export">Export backup ↗</button><label class="outline adm-file">Import backup<input type="file" accept="application/json" hidden data-edit="import"></label><button type="button" class="outline" data-act="fresh">Clear sample data &amp; start fresh</button>${REMOTE ? '' : '<button type="button" class="outline" data-act="demo">Restore sample data</button>'}<button type="button" class="outline" data-act="preview-takeover">Preview champion takeover</button><button type="button" class="outline" data-act="password">Change password</button><button type="button" class="outline" data-act="lock">Lock control room</button></div>`;
    }
    box.innerHTML = `<h2 class="score-name">RUN THE ARENA.</h2>${state.demo ? '<p class="adm-warn">You are editing SAMPLE data. Go to Data → "Clear sample data &amp; start fresh" before real scoring.</p>' : ''}<div class="adm-tabs">${tabs.map(([id, n]) => `<button type="button" class="${id === adminTab ? 'selected' : ''}" data-act="tab" data-id="${id}">${n}</button>`).join('')}</div><div class="adm-pane">${body}</div><p id="admin-msg" role="status">${esc(adminMsg)}</p>`;
}
function adminSave(msg) {
    adminMsg = msg || '';
    try { persistLocal(); }
    catch { adminMsg = 'Browser storage unavailable. Changes will be lost on reload. Export a backup.'; }
    render();
    renderAdmin();
}
function adminClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'tab') { adminTab = id; adminMsg = ''; renderAdmin(); }
    else if (act === 'plan-mode') { planMode = id; adminMsg = ''; renderAdmin(); }
    else if (act === 'pd-del') {
        const def = clone(planDef()), g = def[Number(id)];
        if (g && confirm(`Remove ${g.fn} and its targets?`)) setPlanDef(def.filter((_, i) => i !== Number(id)));
    }
    else if (act === 'pd-reset') {
        if (confirm('Reset functions and KPIs to the defaults? Targets of removed KPIs are lost.')) setPlanDef(clone(DEFAULT_PLAN_DEF));
    }
    else if (act === 'del-result') { state.results = state.results.filter(r => r.id !== id); enqueue('deleteResult', { id }); adminSave('Result deleted.'); }
    else if (act === 'del-fighter') {
        const f = state.fighters.find(x => x.id === id);
        if (f && confirm(`Remove ${f.name} and all their results?`)) {
            state.fighters = state.fighters.filter(x => x.id !== id);
            state.results = state.results.filter(r => r.fighter !== id);
            enqueue('deleteFighter', { id });
            adminSave('Fighter removed.');
        }
    } else if (act === 'del-kpi') {
        const k = state.kpis.find(x => x.id === id);
        if (k && confirm(`Remove "${k.name}" and all results recorded under it?`)) {
            state.kpis = state.kpis.filter(x => x.id !== id);
            state.results = state.results.filter(r => r.kpi !== id);
            enqueue('deleteKpi', { id });
            adminSave('KPI removed.');
        }
    } else if (act === 'export') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
        a.download = `asfc-arena-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        adminSay('Backup downloaded.');
    } else if (act === 'fresh') {
        if (confirm('Delete all sample fighters and results? KPIs are kept.')) {
            state.fighters = []; state.results = []; state.demo = false;
            enqueue('replaceAll', { state: clone(state) });
            adminSave('Fresh arena ready. Add your fighters.');
        }
    } else if (act === 'demo') {
        if (confirm('Replace everything with the sample data?')) { state = clone(initial); enqueue('replaceAll', { state: clone(state) }); adminSave('Sample data restored.'); }
    } else if (act === 'password') {
        const min = REMOTE ? 6 : 4, p = prompt(`New organizer password (min ${min} characters):`);
        if (p && p.length >= min) {
            if (REMOTE) post('changePassword', { password: p }).then(r => adminSay(r && r.ok ? 'Password changed.' : 'Not changed: ' + ((r && r.error) || 'error'))).catch(() => adminSay('Offline. Password not changed.'));
            else hashPw(p).then(h => { store.set(PW_KEY, h); adminSay('Password changed.'); });
        }
        else if (p !== null) adminSay('Password too short. Not changed.');
    } else if (act === 'preview-takeover') {
        $('#admin').close();
        setTimeout(previewTakeover, 350);
    } else if (act === 'lock') {
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        $('#admin').close();
        toast('Control room locked.');
    }
}
function adminChange(e) {
    const t = e.target, kind = t.dataset.edit;
    if (!kind) return;
    if (kind === 'import') {
        const file = t.files[0];
        if (!file) return;
        file.text().then(txt => {
            const parsed = JSON.parse(txt);
            if (!valid(parsed)) throw Error();
            if (REMOTE && !confirm('Import replaces ALL fighters, KPIs and results for everyone. Continue?')) return;
            state = parsed; enqueue('replaceAll', { state: clone(parsed) }); if (Object.keys(cleanPlans(state.plans)).length || Array.isArray(state.planDef)) markPlans(); adminSave('Backup imported.');
        }).catch(() => adminSay('Invalid backup file. Nothing changed.'));
        return;
    }
    if (kind === 'result-fighter') {   // only offer the KPIs this fighter's function can earn
        adminFighter = t.value;
        const sel = t.form && t.form.querySelector('select[name=kpi]');
        if (sel) sel.innerHTML = kpiOptions(state.fighters.find(x => x.id === t.value));
        return;
    }
    if (kind === 'pd-fn' || kind === 'pd-kpis') {   // edit the plan structure (function name / KPI list)
        const def = clone(planDef()), i = Number(t.dataset.i), g = def[i];
        if (!g) return;
        if (kind === 'pd-fn') {
            const nv = t.value.trim().slice(0, 20);
            if (!nv || def.some((x, j) => j !== i && x.fn.toLowerCase() === nv.toLowerCase())) { adminSay('Function name is empty or already used.'); renderAdmin(); return; }
            const P = state.plans || {};
            g.kpis.forEach(k => { const o = `${k} ${g.fn}`; if (P[o] !== undefined) { P[`${k} ${nv}`] = P[o]; delete P[o]; } });   // keep targets when renaming
            state.plans = P;
            g.fn = nv;
        } else g.kpis = t.value.split(',');
        setPlanDef(def);
        return;
    }
    if (kind === 'plan') {   // no re-render, so Tab moves cleanly from one target to the next
        const key = t.dataset.key, raw = t.value.trim();
        if (!planDef().some(g => g.kpis.some(x => `${x} ${g.fn}` === key))) return;
        if (raw !== '' && !(Number.isFinite(Number(raw)) && Number(raw) >= 0)) { adminSay('Plan must be a number, 0 or more.'); return; }
        state.plans = state.plans || {};
        if (raw === '') delete state.plans[key]; else state.plans[key] = Number(raw);
        try { persistLocal(); } catch {}
        render();
        adminSay(REMOTE ? 'Saving plan…' : 'Plan saved.');
        markPlans();
        return;
    }
    const id = t.dataset.id;
    if (kind === 'fighter-photo') {
        const f = state.fighters.find(x => x.id === id), v = t.value.trim();
        if (!f) return;
        if (v && !(/^https:\/\//i.test(v) && v.length <= 500)) { adminSay('Photo link must start with https:// (max 500 characters).'); return; }
        if (v) f.photo_url = v; else delete f.photo_url;
        enqueue('upsertFighter', { fighter: { ...f, photo_url: v } });
        adminSave(v ? 'Photo saved.' : 'Photo removed.');
        return;
    }
    if (kind === 'fighter-name' || kind === 'fighter-fn') {
        const f = state.fighters.find(x => x.id === id), v = t.value.trim();
        if (!f || !v) { renderAdmin(); return; }
        if (kind === 'fighter-name') f.name = v; else f.function = v;
        enqueue('upsertFighter', { fighter: { ...f } });
        adminSave('Fighter updated.');
    } else if (kind === 'kpi-name' || kind === 'kpi-weight' || kind === 'kpi-fn') {
        const k = state.kpis.find(x => x.id === id);
        if (!k) return;
        if (kind === 'kpi-name') { if (!t.value.trim()) { renderAdmin(); return; } k.name = t.value.trim(); }
        else if (kind === 'kpi-fn') k.function = t.value.trim();
        else { const w = parseFloat(t.value); if (!Number.isFinite(w) || w < 0) { renderAdmin(); return; } k.weight = w; }
        enqueue('upsertKpi', { kpi: { ...k } });
        adminSave('KPI updated. All scores recalculated.');
    }
}
function adminSubmit(e) {
    e.preventDefault();
    const form = e.target, kind = form.dataset.form;
    if (!kind) return;
    const v = Object.fromEntries(new FormData(form));
    if (kind === 'result') {
        const q = Number(v.quantity);
        if (!Number.isInteger(q) || q < 1) return adminSay('Quantity must be a whole number, 1 or more.');
        const rf = state.fighters.find(x => x.id === v.fighter), rk = state.kpis.find(x => x.id === v.kpi);
        if (!rf || !rk) return adminSay('Pick a fighter and a KPI.');
        if (!canEarn(rf, rk)) return adminSay(`"${rk.name}" is a ${rk.function} KPI. ${rf.name} is ${rf.function}.`);
        const res = { id: uid(), fighter: v.fighter, kpi: v.kpi, quantity: q, day: v.day };
        state.results.push(res);
        enqueue('addResult', { result: res });
        adminSave('Result added.');
    } else if (kind === 'fighter') {
        const photo = (v.photo_url || '').trim();
        if (photo && !(/^https:\/\//i.test(photo) && photo.length <= 500)) return adminSay('Photo link must start with https:// (max 500 characters).');
        const fighter = { id: newId('f', state.fighters), name: v.name.trim(), function: v.function.trim() };
        if (photo) fighter.photo_url = photo;
        state.fighters.push(fighter);
        enqueue('upsertFighter', { fighter: { ...fighter } });
        adminSave('Fighter added.');
    } else if (kind === 'kpi') {
        const w = parseFloat(v.weight);
        if (!Number.isFinite(w) || w < 0) return adminSay('Weight must be 0 or more.');
        const kpi = { id: newId('k', state.kpis), name: v.name.trim(), weight: w, function: (v.function || '').trim() };
        state.kpis.push(kpi);
        enqueue('upsertKpi', { kpi: { ...kpi } });
        adminSave('KPI added.');
    } else if (kind === 'plandef') {
        const def = clone(planDef());
        def.push({ fn: v.fn, kpis: String(v.kpis || '').split(',') });
        const clean = cleanPlanDef(def);
        if (clean.length === planDef().length) return adminSay('That function already exists.');
        setPlanDef(clean);
    }
}
function openAdmin() {
    ensureAdminDialog();
    adminMsg = '';
    renderAdmin();
    if (!$('#admin').open) $('#admin').showModal();
}
async function openControl() {
    if (unlocked()) return openAdmin();
    const first = !REMOTE && !store.get(PW_KEY);
    $('#login .helper').textContent = first ? 'First time here: choose an organizer password (min 4 characters). You will use it to unlock this control room on this device.' : 'Enter the organizer password to manage fighters, results and scoring.';
    $('#login-form button').textContent = first ? 'Create password & unlock ↗' : 'Unlock control room ↗';
    $('#login-error').textContent = '';
    $('#login').showModal();
}
$('#control').onclick = openControl;
$('#setup').onclick = openControl;
$('#login-form').onsubmit = async e => {
    e.preventDefault();
    const pw = $('#control-password').value, saved = store.get(PW_KEY);
    $('#control-password').value = '';
    if (REMOTE) {
        $('#login-error').textContent = 'Checking…';
        try {
            const r = await post('login', { password: pw });
            if (!r || !r.ok) {
                $('#login-error').textContent = r && r.error === 'too_many_attempts' ? 'Too many attempts. Wait 5 minutes.' : r && r.error === 'no_password_set' ? 'No organizer password is set on the server yet.' : 'Incorrect password. Try again.';
                return;
            }
            try { sessionStorage.setItem(SESSION_KEY, r.token); } catch {}
        } catch { $('#login-error').textContent = 'Cannot reach the server. Check your connection.'; return; }
        $('#login-error').textContent = '';
        $('#login').close();
        openAdmin();
        flush();
        pushPlans();
        return;
    }
    if (!saved) {
        if (pw.length < 4) { $('#login-error').textContent = 'Use at least 4 characters.'; return; }
        if (!store.set(PW_KEY, await hashPw(pw))) { $('#login-error').textContent = 'Browser storage unavailable. Cannot save a password.'; return; }
    } else if (await hashPw(pw) !== saved) {
        $('#login-error').textContent = 'Incorrect password. Try again.';
        return;
    }
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    $('#login').close();
    openAdmin();
};
/* ====================================================================
   MOTION PACK: live ticker · count-ups · rank slides · champion takeover
   · film grain / cigarette burns / splice frames
   ==================================================================== */
const osReduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const motionForced = () => { try { return localStorage.getItem('asfc-motion') === 'on' || /[?&]motion=on\b/.test(location.search); } catch { return /[?&]motion=on\b/.test(location.search); } };
const reduceMotion = () => osReduce() && !motionForced();      // the OS setting wins unless the visitor flips the switch below
document.documentElement.classList.toggle('fx-on', motionForced());
(function motionSwitch() {                                     // only shown to people whose device asks for reduced motion
    const bar = document.querySelector('.top-line');
    if (!bar || !osReduce()) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'motion-toggle';
    b.textContent = motionForced() ? 'MOTION: ON · TURN OFF' : 'MOTION: OFF · TURN ON';
    b.onclick = () => { try { localStorage.setItem('asfc-motion', motionForced() ? 'off' : 'on'); } catch {} location.href = location.pathname; };
    bar.insertBefore(b, bar.lastElementChild);
})();
const shown = new Map();                       // key -> number currently on screen (so re-renders continue, not restart)
const easeOut = t => 1 - Math.pow(1 - t, 3);
function animateNumber(el, key, to, ms = 1100) {
    if (!el) return;
    if (el._raf) cancelAnimationFrame(el._raf);
    clearTimeout(el._fin);
    const from = shown.has(key) ? shown.get(key) : 0;
    if (from === to || reduceMotion()) { shown.set(key, to); el.textContent = format(to); return; }
    const t0 = performance.now(), whole = Number.isInteger(from) && Number.isInteger(to);
    const step = now => {
        const p = Math.min(1, (now - t0) / ms), v = from + (to - from) * easeOut(p);
        const cur = p === 1 ? to : (whole ? Math.round(v) : Math.round(v * 100) / 100);
        shown.set(key, cur);
        el.textContent = format(cur);
        if (p < 1) el._raf = requestAnimationFrame(step);
    };
    shown.set(key, from);
    el.textContent = format(from);
    el._raf = requestAnimationFrame(step);
    el._fin = setTimeout(() => { cancelAnimationFrame(el._raf); shown.set(key, to); el.textContent = format(to); }, ms + 400);   // safety net for throttled tabs
}
const setCount = (el, key, to) => animateNumber(el, key, to);
function runCounts(root) {
    if (!root) return;
    root.querySelectorAll('data.cnt[data-key]').forEach(el => animateNumber(el, el.dataset.key, Number(el.getAttribute('value'))));
}

/* ---------- Overall standings (ignores the Day tab) ---------- */
function overallLeaders() {
    const tot = new Map(state.fighters.map(f => [f.id, 0]));
    state.results.forEach(r => { if (tot.has(r.fighter)) tot.set(r.fighter, tot.get(r.fighter) + points(r)); });
    return state.fighters.map(f => ({ f, p: tot.get(f.id) })).sort((a, b) => b.p - a.p || a.f.name.localeCompare(b.f.name));
}

/* ---------- Rank movement: arrows + slide (FLIP) ---------- */
const DELTA_MS = 14000;
const lastRanks = { day: null, map: new Map() };
const activeDeltas = new Map();
function trackRanks(rows) {
    if (lastRanks.day !== day) activeDeltas.clear();
    else rows.forEach(f => {
        const old = lastRanks.map.get(f.id);
        if (old !== undefined && old !== f.rank) activeDeltas.set(f.id, { d: old - f.rank, t: Date.now() });
    });
    lastRanks.day = day;
    lastRanks.map = new Map(rows.map(f => [f.id, f.rank]));
}
function deltaInfo(id) {
    const x = activeDeltas.get(id);
    if (!x) return null;
    const age = Date.now() - x.t;
    if (age > DELTA_MS) { activeDeltas.delete(id); return null; }
    return { d: x.d, age };
}
const deltaBadge = di => di ? `<sup class="delta ${di.d > 0 ? 'up' : 'down'}">${di.d > 0 ? '▲' : '▼'}${Math.abs(di.d)}</sup>` : '';
function snapshotRows(tb) {
    const m = new Map();
    tb.querySelectorAll('tr[data-fighter]').forEach(tr => m.set(tr.dataset.fighter, tr.getBoundingClientRect().top));
    return m;
}
function playFlip(tb, before) {
    if (reduceMotion() || !before || !before.size) return;
    tb.querySelectorAll('tr[data-fighter]').forEach(tr => {
        const old = before.get(tr.dataset.fighter);
        if (old === undefined) return;
        const dy = old - tr.getBoundingClientRect().top;
        if (Math.abs(dy) < 2) return;
        tr.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 750, easing: 'cubic-bezier(.2,.9,.25,1)' });
    });
}

/* ---------- Projector mode: a live TV board you can leave on all day ----------
   Overall ranking (ignores the Day tab) + today's points · bumps and rank moves as results land ·
   function leaders · latest hits · auto-pages if there are more than 10 fighters ·
   fullscreen + screen wake lock · LIVE / OFFLINE indicator · Esc exits */
const TV = { on: false, ready: false, page: 0, fs: false, ranks: new Map(), pts: new Map(), moves: new Map(), bumps: new Map(), newAt: new Map(), seen: null, timers: [], wake: null, idle: 0 };
const TV_PAGE = 10, TV_FLASH = 9000, TV_MOVE = 14000, TV_ROTATE = 12000;
const tvPad = n => String(n).padStart(2, '0');
const tvAge = (map, id, ms = TV_FLASH) => { const x = map.get(id); if (!x) return null; const age = Date.now() - x.t; if (age > ms) { map.delete(id); return null; } return { ...x, age }; };
const tvToday = () => { const d = new Date(Date.now() + 2 * 3600000).getUTCDate(); return d > 22 ? '22' : d < 19 ? '19' : String(d); };
const cairoTime = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
function tvStatus() {
    if (!REMOTE) return { ok: true, t: 'LOCAL' };
    const stale = sync.mode !== 'ok' || Date.now() - sync.lastOk > 75000;
    return stale ? { ok: false, t: `OFFLINE · LAST UPDATE ${sync.lastOk ? cairoTime(sync.lastOk) : '—'}` } : { ok: true, t: 'LIVE' };
}
function ensureTV() {
    let el = $('#tv');
    if (el) return el;
document.body.insertAdjacentHTML('beforeend', `
    <div id="tv" hidden aria-live="off">
        <div class="tv-top">
            <div class="tv-brand">
                <img src="seal-256.png" alt="">
                <span>AIN SHAMS<br><b>FIGHT CLUB</b></span>
            </div>
            <div class="tv-mid">
                <b id="tv-day"></b>
                <span>19—22 NOVEMBER · THE ARENA</span>
            </div>
            <div class="tv-clock">
                <b id="tv-time"></b>
                <span id="tv-status" class="tv-status"><i></i><em></em></span>
            </div>
        </div>
        <div class="tv-grid">
            <section class="tv-board">
                <div class="tv-head">
                    <span>RANK</span>
                    <span>FIGHTER</span>
                    <span>TODAY</span>
                    <span>TOTAL</span>
                </div>
                <div id="tv-rows"></div>
                <div id="tv-pager" class="tv-pager"></div>
            </section>
            <aside class="tv-side">
                <section class="tv-panel">
                    <h3>FUNCTION LEADERS</h3>
                    <div id="tv-fns" class="tv-fns"></div>
                </section>
                <section class="tv-panel tv-feedpanel">
                    <h3>LATEST HITS</h3>
                    <div id="tv-feed"></div>
                </section>
            </aside>
        </div>
        <div class="tv-foot">
            <span id="tv-stats"></span>
            <span>EARN YOUR PLACE.</span>
            <span class="tv-hint">ESC TO EXIT</span>
        </div>
        <div class="tv-tools">
            <button type="button" class="tv-exit" id="tv-theme">☀ Light</button>
            <button type="button" class="tv-exit" id="tv-exit">✕ Exit</button>
        </div>
    </div>
`);    $('#tv-exit').onclick = () => setTV(false);
      $('#tv-theme').onclick = () => { const b = $('#theme-toggle'); if (b) b.click(); tvThemeLabel(); };
    tvThemeLabel();
    ['mousemove', 'mousedown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => {
        if (!TV.on) return;
        document.body.classList.remove('tv-idle');
        clearTimeout(TV.idle);
        TV.idle = setTimeout(() => document.body.classList.add('tv-idle'), 3000);
    }, { passive: true }));
    return $('#tv');
}

function tvThemeLabel() {
    const b = $('#tv-theme');
    if (b) b.textContent = document.documentElement.dataset.theme === 'light' ? '☾ Dark' : '☀ Light';
}
function tvTick() {
    if (!TV.on) return;
  tvThemeLabel();
    $('#tv-time').textContent = cairoTime(Date.now());
    const s = tvStatus(), el = $('#tv-status');
    el.className = 'tv-status ' + (s.ok ? 'ok' : 'bad');
    el.querySelector('em').textContent = s.t;
}
function renderTV() {
    if (!TV.on) return;
    const el = ensureTV(), today = tvToday(), now = Date.now();
    const tot = new Map(), tod = new Map();
    state.fighters.forEach(f => { tot.set(f.id, 0); tod.set(f.id, 0); });
    state.results.forEach(r => {
        if (!tot.has(r.fighter)) return;
        const p = points(r);
        tot.set(r.fighter, tot.get(r.fighter) + p);
        if (r.day === today) tod.set(r.fighter, tod.get(r.fighter) + p);
    });
    const rows = state.fighters.map(f => ({ f, p: tot.get(f.id), t: tod.get(f.id) })).sort((a, b) => b.p - a.p || a.f.name.localeCompare(b.f.name));
    let rk = 0;
    rows.forEach((r, i) => { if (i === 0 || r.p !== rows[i - 1].p) rk = i + 1; r.rank = rk; });
    if (TV.ready) rows.forEach(r => {                       // what changed since the last data update
        const old = TV.ranks.get(r.f.id), op = TV.pts.get(r.f.id);
        if (old !== undefined && old !== r.rank) TV.moves.set(r.f.id, { d: old - r.rank, t: now });
        if (op !== undefined && r.p > op) TV.bumps.set(r.f.id, { g: r.p - op, t: now });
    });
    TV.ranks = new Map(rows.map(r => [r.f.id, r.rank]));
    TV.pts = new Map(rows.map(r => [r.f.id, r.p]));
    if (!TV.seen) TV.seen = new Set(state.results.map(r => r.id));
    else state.results.forEach(r => { if (!TV.seen.has(r.id)) { TV.seen.add(r.id); TV.newAt.set(r.id, { t: now }); } });
    TV.ready = true;

    $('#tv-day').textContent = `DAY ${tvPad(Number(today) - 18)}`;
    const pages = Math.max(1, Math.ceil(rows.length / TV_PAGE));
    if (TV.page >= pages) TV.page = 0;
    const slice = rows.slice(TV.page * TV_PAGE, (TV.page + 1) * TV_PAGE), box = $('#tv-rows');
    const before = new Map();
    box.querySelectorAll('[data-id]').forEach(n => before.set(n.dataset.id, n.getBoundingClientRect().top));
    box.innerHTML = slice.map(r => {
        const f = r.f, mv = tvAge(TV.moves, f.id, TV_MOVE), bp = tvAge(TV.bumps, f.id);
        return `<div class="tv-row r${Math.min(r.rank, 4)}${bp ? ' bump' : ''}" data-id="${esc(f.id)}"${bp ? ` style="--age:${bp.age}ms"` : ''}><div class="tv-rank">${tvPad(r.rank)}${mv ? `<sup class="tv-mv ${mv.d > 0 ? 'up' : 'down'}">${mv.d > 0 ? '▲' : '▼'}${Math.abs(mv.d)}</sup>` : ''}</div><div class="tv-fighter">${avatar(f)}<div class="tv-name"><b>${esc(f.name)}</b><span class="tv-fn">${esc(f.function)}</span></div></div><div class="tv-today">${r.t > 0 ? '+' + format(r.t) : '—'}</div><div class="tv-total">${bp ? `<i class="tv-gain">+${format(bp.g)}</i>` : ''}<data class="cnt" value="${r.p}" data-key="tv:${esc(f.id)}">${format(r.p)}</data></div></div>`;
    }).join('') || '<p class="tv-empty">THE ARENA IS EMPTY.<br>ADD FIGHTERS IN THE CONTROL ROOM.</p>';
    if (before.size && !reduceMotion()) box.querySelectorAll('[data-id]').forEach(n => {
        const o = before.get(n.dataset.id);
        if (o === undefined) return;
        const dy = o - n.getBoundingClientRect().top;
        if (Math.abs(dy) > 2) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 800, easing: 'cubic-bezier(.2,.9,.25,1)' });
    });
    runCounts(box);
    $('#tv-pager').innerHTML = pages > 1 ? `<span>${TV.page * TV_PAGE + 1}—${Math.min(rows.length, (TV.page + 1) * TV_PAGE)} OF ${rows.length}</span><span class="tv-dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === TV.page ? 'on' : ''}"></i>`).join('')}</span>` : '';

    const byFn = new Map();
    rows.forEach(r => { const k = fnKey(r.f); if (!byFn.has(k)) byFn.set(k, []); byFn.get(k).push(r); });
    $('#tv-fns').innerHTML = [...byFn.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, list]) => {
        const top = list[0], has = top.p > 0;
        return `<div class="tv-fcard"><span class="tv-fkey">${esc(k)}</span><b>${has ? esc(top.f.name) : '—'}</b><span class="tv-fpts">${has ? format(top.p) + ' PTS' : 'NO POINTS YET'}</span></div>`;
    }).join('') || '<p class="tv-empty">NO FUNCTIONS YET.</p>';

    $('#tv-feed').innerHTML = state.results.slice(-8).reverse().map(r => {
        const f = state.fighters.find(x => x.id === r.fighter), k = state.kpis.find(x => x.id === r.kpi);
        if (!f || !k) return '';
        const nw = tvAge(TV.newAt, r.id);
        return `<div class="tv-hit${nw ? ' fresh' : ''}"${nw ? ` style="--age:${nw.age}ms"` : ''}><div><b>${esc(f.name)}</b><small>${r.quantity} × ${esc(k.name)} · DAY ${tvPad(Number(r.day) - 18)}</small></div><b class="tv-pts">+${format(points(r))}</b></div>`;
    }).join('') || '<p class="tv-empty">WAITING FOR THE FIRST HIT.</p>';

    $('#tv-stats').textContent = `${state.fighters.length} FIGHTERS · ${format(rows.reduce((n, r) => n + r.p, 0))} POINTS · ${state.results.filter(r => r.day === today).length} RESULTS TODAY`;
    tvTick();
}
async function tvWake() {
    try { if (TV.on && !document.hidden && 'wakeLock' in navigator) TV.wake = await navigator.wakeLock.request('screen'); } catch {}
}
function setTV(on) {
    if (on === TV.on) return;
    TV.on = on;
    document.body.classList.toggle('projector', on);
    $('#projector').textContent = on ? '↙ Exit projector mode' : '⛶ Projector mode';
    if (on) {
        ensureTV().hidden = false;
        TV.ready = false; TV.seen = null; TV.page = 0; TV.moves.clear(); TV.bumps.clear(); TV.newAt.clear();
        renderTV();
        TV.timers = [setInterval(tvTick, 5000), setInterval(() => {
            if (state.fighters.length > TV_PAGE) { TV.page++; renderTV(); }
            else renderTV();                                  // also expires old flashes
        }, TV_ROTATE)];
        TV.idle = setTimeout(() => document.body.classList.add('tv-idle'), 3000);
        const root = document.documentElement;
        if (root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().then(() => { TV.fs = true; }).catch(() => {});
        tvWake();
    } else {
        TV.timers.forEach(clearInterval); TV.timers = [];
        clearTimeout(TV.idle);
        document.body.classList.remove('tv-idle');
        const el = $('#tv'); if (el) el.hidden = true;
        try { TV.wake && TV.wake.release(); } catch {}
        TV.wake = null;
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        TV.fs = false;
        window.scrollTo(0, 0);
    }
}
document.addEventListener('fullscreenchange', () => { if (TV.on && TV.fs && !document.fullscreenElement) setTV(false); });   // Esc in fullscreen = leave projector mode
document.addEventListener('visibilitychange', () => { if (TV.on && !document.hidden) { tvWake(); renderTV(); } });

/* ---------- Live ticker ---------- */
let tkSig = '';
function renderTicker() {
    const el = document.querySelector('.fight-ticker');
    if (!el) return;
    const slogans = ['EARN YOUR PLACE', 'LET THE RESULTS TALK', 'FOUR DAYS. ONE CHAMPION.', 'NO SPECTATORS'];
    const first = n => String(n).split(' ')[0].toUpperCase();
    const live = [], board = overallLeaders(), a = board[0], b = board[1];
    if (a && a.p > 0) {
        live.push(`THE ONE TO BEAT · ${a.f.name.toUpperCase()} · ${format(a.p)} PTS`);
        if (b && b.p > 0) live.push(a.p === b.p ? `${first(a.f.name)} AND ${first(b.f.name)} ARE TIED` : `${first(b.f.name)} IS ${format(a.p - b.p)} PTS BEHIND ${first(a.f.name)}`);
    }
    state.results.slice(-5).reverse().forEach(r => {
        const f = state.fighters.find(x => x.id === r.fighter), k = state.kpis.find(x => x.id === r.kpi);
        if (f && k) live.push(`${f.name.toUpperCase()} +${format(points(r))} · ${r.quantity} × ${k.name.toUpperCase()}`);
    });
    let best = null;
    state.results.forEach(r => { const p = points(r); if (!best || p > best.p) best = { r, p }; });
    if (best) {
        const f = state.fighters.find(x => x.id === best.r.fighter);
        if (f) live.push(`BIGGEST HIT · ${f.name.toUpperCase()} · +${format(best.p)} PTS`);
    }
    const items = [];
    for (let i = 0; i < Math.max(live.length, slogans.length); i++) {
        if (live[i]) items.push({ t: live[i], live: true });
        items.push({ t: slogans[i % slogans.length] });
    }
    const seq = items.map(x => `<i class="tk${x.live ? ' tk-live' : ''}">${esc(x.t)}</i><i class="tk-sep">×</i>`).join('');
    if (seq === tkSig && el.querySelector('.ticker-track')) return;
    tkSig = seq;
    el.innerHTML = '<div class="ticker-track"><div class="tk-group"></div><div class="tk-group"></div></div>';
    const track = el.firstChild, g1 = track.children[0], g2 = track.children[1];
    g1.innerHTML = seq;
    for (let n = 1; g1.scrollWidth < el.clientWidth && n < 8; n++) g1.innerHTML += seq;
    g2.innerHTML = g1.innerHTML;
    track.style.setProperty('--tk-dur', Math.max(24, Math.round(g1.scrollWidth / 65)) + 's');
}
let tkResize;
window.addEventListener('resize', () => { clearTimeout(tkResize); tkResize = setTimeout(() => { tkSig = ''; renderTicker(); }, 250); });

/* ---------- New champion takeover ---------- */
let champ = null, liveReady = !REMOTE, pendingChamp = null;
function checkChampion() {
    const s = overallLeaders(), a = s[0], b = s[1];
    if (!a || !(a.p > 0) || (b && b.p === a.p)) return;           // no strict leader yet: nothing to crown
    const prev = champ;
    champ = { id: a.f.id, name: a.f.name };
    if (!prev || prev.id === a.f.id || !liveReady) return;         // first sight, same champion, or still loading
    if (document.querySelector('#admin[open]')) return;            // never interrupt the organizer entering results
    const info = { fighter: a.f, pts: a.p, prev: prev.name, number: fno(a.f) };
    if (document.hidden) { pendingChamp = info; return; }
    showTakeover(info);
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingChamp) { const i = pendingChamp; pendingChamp = null; showTakeover(i); }
});
function shardsHTML(n = 44) {
    if (reduceMotion()) return '';
    const cols = ['#e7dfd0', '#e7dfd0', '#b6bba6', '#e74750'], far = Math.max(innerWidth, innerHeight) * .6;
    let h = '';
    for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, dist = 160 + Math.random() * far;
        h += `<i class="sh" style="--dx:${Math.round(Math.cos(ang) * dist)}px;--dy:${Math.round(Math.sin(ang) * dist + 140)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--w:${6 + (Math.random() * 16 | 0)}px;--h:${14 + (Math.random() * 34 | 0)}px;--c:${cols[i % cols.length]};--d:${(.42 + Math.random() * .18).toFixed(2)}s"></i>`;
    }
    return h;
}
function showTakeover(info) {
    pendingChamp = null;
    let d = $('#takeover');
    if (!d) {
        d = document.createElement('dialog');
        d.id = 'takeover';
        d.setAttribute('aria-label', 'New champion');
        document.body.appendChild(d);
        d.addEventListener('click', closeTakeover);
        d.addEventListener('close', () => {
            clearTimeout(closeTakeover.t);
            d.classList.remove('out');
            const c = $('.champion');
            if (c) { c.classList.remove('crowned'); void c.offsetWidth; c.classList.add('crowned'); }
        });
    }
    const f = info.fighter;
    const art = imgTag(f, 'to-photo', 360) || `<span class="to-init">${esc(initials(f.name))}</span>`;
    d.classList.remove('out');
    d.innerHTML = `<div class="to-seal-bg"><img src="seal-640.png" alt=""></div><div class="to-flash"></div>${shardsHTML()}<div class="to-inner"><p class="to-kicker">/// THE THRONE HAS CHANGED HANDS</p><h2 class="to-title">NEW<br><em>CHAMPION.</em></h2><div class="to-card">${art}<div class="to-id"><span class="to-num">FIGHTER ${String(info.number).padStart(3, '0')}</span><b class="to-name">${esc(f.name)}</b><span class="to-meta">${esc(f.function)} · <data class="cnt" value="${info.pts}" data-key="to:pts">0</data> PTS</span></div></div>${info.prev && info.prev !== f.name ? `<p class="to-fallen"><s>${esc(info.prev)}</s> HAS FALLEN.</p>` : ''}</div><p class="to-hint">CLICK ANYWHERE TO CONTINUE</p>`;
    shown.delete('to:pts');
    if (!d.open) d.showModal();
    runCounts(d);
    clearTimeout(closeTakeover.t);
    closeTakeover.t = setTimeout(closeTakeover, 9000);
}
function closeTakeover() {
    const d = $('#takeover');
    if (!d || !d.open || d.classList.contains('out')) return;
    clearTimeout(closeTakeover.t);
    d.classList.add('out');
    setTimeout(() => { if (d.open) d.close(); }, reduceMotion() ? 0 : 350);
}
function previewTakeover() {
    const s = overallLeaders();
    if (!s.length) { toast('Add a fighter first.'); return; }
    const a = s[0], b = s[1] || s[0];
    showTakeover({ fighter: a.f, pts: a.p, prev: b.f.name, number: fno(a.f) });
}
window.arena = { takeover: previewTakeover };

/* ---------- Cigarette burns + splice frames (rare, subtle, never during dialogs) ---------- */
const SPLICES = [['RULE #01', 'SHOW UP.'], ['RULE #02', 'SHOW UP AGAIN.'], ['', 'EARN YOUR PLACE.'], ['', 'NO SPECTATORS.'], ['', 'THE FLOOR IS YOURS.'], ['', 'LET THE RESULTS TALK.']];
function ensureFx() {
    if ($('#splice')) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="burn" aria-hidden="true"></div><div id="splice" aria-hidden="true"><small></small><b></b></div>');
}
const blink = (el, ms) => { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), ms); };
function punch() {
    if (document.hidden || reduceMotion() || document.querySelector('dialog[open]')) return;
    ensureFx();
    const burn = $('#burn'), sp = $('#splice'), pool = SPLICES.slice(), top = overallLeaders()[0];
    if (top && top.p > 0) pool.push(['THE ONE TO BEAT', top.f.name]);
    const [kick, text] = pool[Math.floor(Math.random() * pool.length)];
    sp.querySelector('small').textContent = kick;
    sp.querySelector('b').textContent = text.toUpperCase();
    blink(burn, 90);
    setTimeout(() => blink(burn, 90), 220);
    setTimeout(() => blink(sp, 70), 820);                     // ~2 frames, a beat after the reel mark
}
(function fxLoop(firstRun = true) {
    setTimeout(() => { try { punch(); } catch {} fxLoop(false); }, firstRun ? 25000 + Math.random() * 15000 : 50000 + Math.random() * 50000);
})();

countdown();
setInterval(countdown, 60000);

render();


/* ---------- Typed dossier text ---------- */
function typeOut(root) {
    if (reduceMotion()) return;
    const els = [...root.querySelectorAll('[data-type]')], texts = els.map(e => e.textContent), cur = document.createElement('span');
    cur.className = 'tw-cursor';
    els.forEach(e => { e.style.minHeight = e.offsetHeight + 'px'; e.textContent = ''; });   // hold the space so nothing jumps
    let i = 0;
    (function next() {
        const e = els[i];
        if (!e || !e.isConnected) { setTimeout(() => cur.remove(), 1600); return; }
        let n = 0;
        (function step() {
            if (!e.isConnected) return;
            e.textContent = texts[i].slice(0, ++n); e.append(cur);
            if (n < texts[i].length) setTimeout(step, 18); else { i++; setTimeout(next, 90); }
        })();
    })();
}

/* ---------- Headline: types in, then PLACE glitches on hover ---------- */
(function headline() {
    const h = document.querySelector('.intro h1');
    if (!h) return;
    h.setAttribute('aria-label', 'Earn your place.');
    const chars = [];
    (function wrap(node) {
        [...node.childNodes].forEach(n => {
            if (n.nodeType === 3) {
                const frag = document.createDocumentFragment();
                [...n.textContent].forEach(c => { const s = document.createElement('span'); s.className = 'tw'; s.setAttribute('aria-hidden', 'true'); s.textContent = c; chars.push(s); frag.append(s); });
                n.replaceWith(frag);
            } else if (n.nodeType === 1 && n.tagName !== 'BR') wrap(n);
        });
    })(h);
    if (reduceMotion() || !chars.length) return;
    h.classList.add('tw-typing');
    const cur = document.createElement('span');
    cur.className = 'tw-cursor';
    let i = 0;
    (function type() {
        if (i >= chars.length) {
            h.classList.remove('tw-typing'); h.classList.add('tw-glitch');
            setTimeout(() => h.classList.remove('tw-glitch'), 650);
            setTimeout(() => cur.remove(), 2200);
            return;
        }
        chars[i].classList.add('on'); chars[i].after(cur); i++;
        setTimeout(type, 55 + Math.random() * 70);
    })();
})();

/* ---------- Hand-stamped: stable random ±2° per stamp (hash of label + fighter, so polling never reshuffles) ---------- */
(function ink() {
    const SEL = '.tag,.func-tag,.belt,.chip,.ribbon,.fn-seal';
    const stamp = () => document.querySelectorAll(SEL).forEach(el => {
        if (el.dataset.ink) return;
        el.dataset.ink = '1';
        const k = el.textContent + (el.closest('[data-fighter]')?.dataset.fighter || '');
        let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0;
        el.style.setProperty('--rot', ((Math.abs(h) % 401) / 100 - 2).toFixed(2) + 'deg');
    });
    let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(stamp, 120); }).observe(document.body, { childList: true, subtree: true });
    stamp();
})();

/* ---------- Theme toggle (dark / light) ---------- */
(function theme() {
    const KEY = 'asfc-theme', root = document.documentElement;
    const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
    const bar = document.querySelector('.top-line');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'theme-toggle';
    const apply = t => {
        root.dataset.theme = t;
        const m = document.querySelector('meta[name=theme-color]');
        if (m) m.content = t === 'light' ? '#f4efe4' : '#11100f';
        btn.textContent = t === 'light' ? '☾ DARK MODE' : '☀ LIGHT MODE';
    };
    btn.onclick = () => {
        const next = root.dataset.theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(KEY, next); } catch {}
        apply(next);
    };
    if (bar) bar.insertBefore(btn, bar.lastElementChild);
    apply(get() === 'light' ? 'light' : 'dark');
})();
