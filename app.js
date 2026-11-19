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
const API_URL = '';
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

/* ---------- Photos ---------- */
function photoSrc(u) {
    u = String(u || '').trim();
    if (!/^https:\/\//i.test(u)) return '';
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : u;   // normal Drive share links just work
}
function avatar(f, cls = 'mini-avatar') {
    const src = photoSrc(f.photo_url);
    return `<span class="${cls}">${esc(initials(f.name))}${src ? `<img src="${esc(src)}" alt="${esc(f.name)}" loading="lazy" width="40" height="40" onerror="this.remove()">` : ''}</span>`;
}
function photoTag(f) {
    const src = photoSrc(f.photo_url);
    return src ? `<img class="fighter-photo" src="${esc(src)}" alt="${esc(f.name)}" loading="lazy" width="88" height="88" onerror="this.remove()">` : '';
}
document.head.insertAdjacentHTML('beforeend', '<style id="arena-extra-css">'
    + '.mini-avatar{position:relative;overflow:hidden}'
    + '.mini-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.1)}'
    + '.fighter-photo{display:block;width:88px;height:88px;object-fit:cover;filter:grayscale(1) contrast(1.1);border:2px solid rgba(255,255,255,.25);margin:0 0 12px}'
    + '#fn-board{margin-top:32px}#fn-board .fn-total{opacity:.7;margin-left:6px;font-size:.8em}#fn-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}'
    + '.adm-row.edit input[data-edit=fighter-photo]{flex:1 1 100%;grid-column:1/-1;min-width:0}'
    + '</style>');

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
    sec.dataset.tabClass = periodBtn ? periodBtn.className.replace(/\bselected\b/g, '').trim() : '';
    sec.dataset.tabsWrap = $('#periods') ? $('#periods').className : '';
    sec.innerHTML = '<div class="panel-heading"><h3>FUNCTION BOARDS.</h3><span class="eyebrow" id="fn-period"></span></div><div id="fn-tabs" role="tablist"></div>'
        + `<div class="${esc(wrapClass)}"><table class="${esc(table.className)}">${table.querySelector('thead') ? table.querySelector('thead').outerHTML : ''}<tbody id="fn-rankings"></tbody></table></div>`;
    anchor.insertAdjacentElement('afterend', sec);
    $('#fn-tabs').className = sec.dataset.tabsWrap;
    $('#fn-tabs').style.display = 'flex';
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
    $('#fn-rankings').innerHTML = list.map(f => `<tr class="${f.frank === 1 ? 'first-row' : ''}" tabindex="0" role="button" aria-label="View ${esc(f.name)} scorecard" data-fighter="${esc(f.id)}"><td>${String(f.frank).padStart(2, '0')}</td><td><div class="fighter-cell">${avatar(f)}<div><b>${esc(f.name)}</b><small>OVERALL #${String(f.rank).padStart(2, '0')}</small></div></div></td><td><span class="func-tag">${esc(f.function)}</span></td><td>${format(f.quantity)}</td><td>${format(f.points)}</td><td>${f.frank === 1 ? 'THE LEAD' : f.gap === 0 ? 'TIED' : `${format(f.gap)} PTS`}</td><td>↗</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No fighters in this function.</td></tr>';
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
    const rows = ranked()
      , lead = rows[0];
    $('.demo').innerHTML = `<i></i> ${state.demo ? 'DEMO ARENA' : REMOTE ? 'LIVE ARENA' : 'LOCAL ARENA'}`;
    $('.notice').hidden = !state.demo;
    $('#total-fighters').textContent = state.fighters.length;
    $('#total-points').textContent = format(rows.reduce( (n, f) => n + f.points, 0));
    $('#leader-name').textContent = lead?.name || 'YOUR SPOT AWAITS';
    $('#leader-function').textContent = lead?.function || 'THE ARENA IS OPEN';
    $('#leader-initials').textContent = lead ? initials(lead.name) : 'FC';
    $('#leader-number').textContent = lead ? String(state.fighters.findIndex(f => f.id === lead.id) + 1).padStart(3, '0') : '—';
    $('#leader-score').textContent = format(lead?.points || 0);
    $('#leader-lead').textContent = lead ? (rows[1] ? (lead.points === rows[1].points ? 'Tied for the lead. Every result matters.' : `${format(lead.points - rows[1].points)} points ahead of ${rows[1].name.split(' ')[0]}.`) : 'The first fighter in the arena.') : 'Add fighters in the control room to begin.';
    $('#leader-detail').disabled = !lead;
    $('#leader-detail').onclick = () => lead && showScore(lead.id);
    $('#pursuit').innerHTML = rows.slice(1, 3).map(f => `<div class="pursuer" role="button" tabindex="0" data-fighter="${esc(f.id)}"><span class="rank">${String(f.rank).padStart(2, '0')}</span>${avatar(f)}<div><strong>${esc(f.name)}</strong><small>${esc(f.function)} · ${format(lead.points - f.points)} off the lead</small></div><div class="p-points">${format(f.points)}<small>PTS</small></div></div>`).join('') || '<p class="empty">The next challenger could be you.</p>';
    const current = $('#function-filter').value;
    $('#function-filter').innerHTML = '<option value="all">All functions</option>' + [...new Set(state.fighters.map(f => f.function))].sort().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    if ([...$('#function-filter').options].some(x => x.value === current))
        $('#function-filter').value = current;
    renderIdentity();
    renderRows(rows);
    renderFunctionBoard(rows);
    $('#activity').innerHTML = selectedResults().slice(-5).reverse().map(r => {
        let f = state.fighters.find(f => f.id === r.fighter)
          , k = state.kpis.find(k => k.id === r.kpi);
        return `<div class="activity-row"><span class="hit-icon">↗</span><div><p><b>${esc(f.name)}</b></p><small>${r.quantity} × ${esc(k.name)} · Day ${Number(r.day) - 18}</small></div><b>+${format(points(r))}</b></div>`;
    }
    ).join('') || '<p class="empty">No achievements recorded for this period.</p>';
    if (view === 'corner')
        renderCorner();
    $('#rule-cards').innerHTML = state.kpis.map( (k, i) => `<article class="rule-card"><p class="eyebrow">KPI / ${String(i + 1).padStart(2, '0')}</p><h3>${esc(k.name)}</h3><strong>${format(k.weight)}</strong> <small>PTS / RESULT</small></article>`).join('') || '<p class="empty">Add your first KPI in the control room.</p>';
}
function renderRows(rows=ranked()) {
    let query = $('#search').value.trim().toLowerCase()
      , func = $('#function-filter').value;
    let filtered = rows.filter(f => f.name.toLowerCase().includes(query) && (func === 'all' || f.function === func));
    $('#showing').textContent = `${filtered.length} OF ${rows.length} FIGHTERS · ${day === 'all' ? 'ALL FOUR DAYS' : `DAY ${Number(day) - 18}`}`;
    $('#rankings').innerHTML = filtered.map(f => {
        let index = rows.findIndex(r => r.id === f.id)
          , gap = index ? rows[index - 1].points - f.points : 0;
        return `<tr class="${f.rank === 1 ? 'first-row' : ''}" tabindex="0" role="button" aria-label="View ${esc(f.name)} scorecard" data-fighter="${esc(f.id)}"><td>${String(f.rank).padStart(2, '0')}</td><td><div class="fighter-cell">${avatar(f)}<div><b>${esc(f.name)}</b><small>FIGHTER ${String(state.fighters.findIndex(r => r.id === f.id) + 1).padStart(3, '0')}</small></div></div></td><td><span class="func-tag">${esc(f.function)}</span></td><td>${format(f.quantity)}</td><td>${format(f.points)}</td><td>${f.rank === 1 ? 'THE LEAD' : gap === 0 ? 'TIED' : `${format(gap)} PTS`}</td><td>↗</td></tr>`;
    }
    ).join('') || '<tr><td colspan="7" class="empty">No fighters found.</td></tr>';
}
function showScore(id) {
    let f = ranked().find(x => x.id === id);
    if (!f)
        return;
    let rs = selectedResults().filter(r => r.fighter === id);
    $('#scorecard-content').innerHTML = `${photoTag(f)}<h2 class="score-name">${esc(f.name.toUpperCase())}</h2><p class="eyebrow">${esc(f.function)} / RANK ${f.rank} / ${day === 'all' ? 'OVERALL' : `DAY ${Number(day) - 18}`}</p><div class="score-total">${format(f.points)} <small style="font-size:20px">PTS</small></div>${state.kpis.map(k => {
        let q = rs.filter(r => r.kpi === k.id).reduce( (a, r) => a + r.quantity, 0);
        return `<div class="score-line"><span>${esc(k.name)}<br><small>${q} results × ${format(k.weight)} points</small></span><b>${format(q * k.weight)} PTS</b></div>`;
    }
    ).join('')}`;
    $('#scorecard').showModal();
}
function setView(v) {
    view = v;
    $('#arena-view').hidden = v !== 'arena';
    $('#rules-view').hidden = v !== 'rules';
    $('#corner-view').hidden = v !== 'corner';
    if (v === 'corner')
        renderCorner();
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
    if (e.key === 'Escape')
        document.body.classList.remove('projector');
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
$('#projector').onclick = () => {
    let active = document.body.classList.toggle('projector');
    $('#projector').textContent = active ? '↙ Exit projector mode' : '⛶ Projector mode';
}
;
function renderIdentity() {
    const select = $('#identity-select');
    select.innerHTML = '<option value="">Choose your fighter</option>' + state.fighters.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    if (state.fighters.some(f => f.id === myFighter))
        select.value = myFighter;
    else
        myFighter = '';
}
function tier(p) {
    return p >= 600 ? ['HEAVYWEIGHT', 600] : p >= 300 ? ['CONTENDER', 600] : p >= 100 ? ['FIGHTER', 300] : ['ROOKIE', 100];
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
      , level = tier(f.points)
      , rs = selectedResults().filter(r => r.fighter === f.id)
      , gap = rival ? rival.points - f.points + 1 : 0;
    box.innerHTML = `<div class="corner-top"><div class="corner-id">${photoTag(f)}<span class="eyebrow">${esc(f.function)} / INDIVIDUAL COMPETITOR</span><h2>${esc(f.name.toUpperCase())}</h2><span class="belt">${level[0]}</span><p>Badge thresholds: 100 / 300 / 600 points</p></div><div class="corner-number"><span>RANK</span><b>${String(f.rank).padStart(2, '0')}</b></div><div class="corner-number"><span>POINTS</span><b>${format(f.points)}</b></div></div><div class="corner-grid"><article class="rival-card"><p class="eyebrow">${rival ? 'YOUR NEXT TARGET' : 'DEFEND THE TOP SPOT'}</p><h3>${rival ? esc(rival.name.toUpperCase()) : 'THEY ARE<br>COMING FOR YOU.'}</h3><p>${rival ? `Earn <b>${format(gap)} more points</b> to take the next position.` : 'You hold the lead. Keep adding verified results to extend it.'}</p><div class="progress-track"><i style="width:${rival ? Math.min(100, 100 * f.points / (rival.points + 1)) : 100}%"></i></div><small>${format(f.points)} / ${rival ? format(rival.points + 1) : 'THE LEAD'}</small></article><article class="mission-card"><p class="eyebrow">MAKE YOUR NEXT MOVE</p><h3>${rival ? 'CLOSE THE GAP.' : 'RAISE THE BAR.'}</h3><p>Possible next moves using current KPI weights.</p>${state.kpis.filter(k => k.weight > 0).slice().sort( (a, b) => b.weight - a.weight).slice(0, 3).map(k => `<div class="mission-line"><b>${Math.ceil((gap || 50) / k.weight)}×</b><span>${esc(k.name)}<small>${format(k.weight)} points each</small></span><span>↗</span></div>`).join('') || '<p>Add positive KPI weights to see suggested moves.</p>'}<small class="mission-note">Suggestions only. Results must be verified.</small></article></div><section class="personal-history"><div class="panel-heading"><h3>YOUR FOUR ROUNDS.</h3><span class="eyebrow">POINTS BY DAY / ALL DAYS</span></div><div class="round-bars">${['19', '20', '21', '22'].map( (d, i) => {
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
    $('#comparison').innerHTML = `<div class="compare-scores"><div><b>${format(a.points)}</b><span>RANK ${a.rank}</span></div><span>VS</span><div><b>${format(b.points)}</b><span>RANK ${b.rank}</span></div></div><p class="compare-verdict">${a.points === b.points ? 'DEAD EVEN. NEXT RESULT DECIDES.' : `${esc((a.points > b.points ? a : b).name.toUpperCase())} LEADS BY ${format(Math.abs(a.points - b.points))}.`}</p><p class="eyebrow">${day === 'all' ? 'OVERALL' : `DAY ${Number(day) - 18}`} / POINTS BY KPI</p>${state.kpis.map(k => {
        let score = f => selectedResults().filter(r => r.fighter === f.id && r.kpi === k.id).reduce( (n, r) => n + points(r), 0)
          , x = score(a)
          , y = score(b);
        return `<div class="comparison-row"><b class="${x > y ? 'winning' : ''}">${format(x)}</b><span>${esc(k.name)}</span><b class="${y > x ? 'winning' : ''}">${format(y)}</b></div>`;
    }
    ).join('')}`;
}
$('#compare-open').onclick = () => {
    const rows = ranked()
      , opts = rows.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
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
            state = data.state;
            try { persistLocal(); } catch {}
            render();
        }
    } catch { setSync('offline'); }
}
function tick() {
    if (!REMOTE) return;
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
    const tabs = [['results', 'Results'], ['fighters', 'Fighters'], ['kpis', 'KPIs'], ['data', 'Data']];
    const fOpts = state.fighters.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    const kOpts = state.kpis.map(k => `<option value="${esc(k.id)}">${esc(k.name)} (${format(k.weight)})</option>`).join('');
    const dayOpts = ['19', '20', '21', '22'].map((d, i) => `<option value="${d}" ${d === cairoDay() ? 'selected' : ''}>Day 0${i + 1}</option>`).join('');
    let body = '';
    if (adminTab === 'results') {
        const list = state.results.slice().reverse().slice(0, 40).map(r => {
            const f = state.fighters.find(x => x.id === r.fighter), k = state.kpis.find(x => x.id === r.kpi);
            return `<div class="adm-row"><span><b>${esc(f.name)}</b><small>${r.quantity} × ${esc(k.name)} · Day ${Number(r.day) - 18}</small></span><b>+${format(points(r))}</b><button type="button" class="adm-x" data-act="del-result" data-id="${esc(r.id)}" aria-label="Delete result">×</button></div>`;
        }).join('') || '<p class="helper">No results yet.</p>';
        body = state.fighters.length && state.kpis.length
            ? `<form class="adm-form" data-form="result"><label>Fighter<select name="fighter">${fOpts}</select></label><label>KPI<select name="kpi">${kOpts}</select></label><label>Qty<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Day<select name="day">${dayOpts}</select></label><button class="primary">Add result</button></form><h4>Latest 40 results</h4><div class="adm-list">${list}</div>`
            : '<p class="helper">Add at least one fighter and one KPI first.</p>';
    } else if (adminTab === 'fighters') {
        const fns = [...new Set(state.fighters.map(f => f.function))].map(x => `<option value="${esc(x)}">`).join('');
        body = `<form class="adm-form" data-form="fighter"><label>Name<input name="name" required maxlength="60"></label><label>Function<input name="function" list="fn-list" required maxlength="20"></label><label>Photo link<input name="photo_url" maxlength="500" placeholder="https://… (optional, Drive share link ok)"></label><datalist id="fn-list">${fns}</datalist><button class="primary">Add fighter</button></form><div class="adm-list">${state.fighters.map(f => `<div class="adm-row edit"><input data-edit="fighter-name" data-id="${esc(f.id)}" value="${esc(f.name)}" aria-label="Name"><input data-edit="fighter-fn" data-id="${esc(f.id)}" value="${esc(f.function)}" aria-label="Function" list="fn-list"><input data-edit="fighter-photo" data-id="${esc(f.id)}" value="${esc(f.photo_url || '')}" placeholder="Photo link (https://…)" aria-label="Photo link" maxlength="500"><button type="button" class="adm-x" data-act="del-fighter" data-id="${esc(f.id)}" aria-label="Remove fighter">×</button></div>`).join('') || '<p class="helper">No fighters yet.</p>'}</div>`;
    } else if (adminTab === 'kpis') {
        body = `<p class="helper">Changing a weight recalculates every score in the arena.</p><form class="adm-form" data-form="kpi"><label>KPI name<input name="name" required maxlength="60"></label><label>Points each<input name="weight" type="number" min="0" step="any" required></label><button class="primary">Add KPI</button></form><div class="adm-list">${state.kpis.map(k => `<div class="adm-row edit"><input data-edit="kpi-name" data-id="${esc(k.id)}" value="${esc(k.name)}" aria-label="KPI name"><input data-edit="kpi-weight" data-id="${esc(k.id)}" type="number" min="0" step="any" value="${k.weight}" aria-label="Weight"><button type="button" class="adm-x" data-act="del-kpi" data-id="${esc(k.id)}" aria-label="Remove KPI">×</button></div>`).join('') || '<p class="helper">No KPIs yet.</p>'}</div>`;
    } else {
        body = `<p class="helper">${REMOTE ? 'Scores live in the shared Google Sheet and sync to every device. Export a backup before big changes.' : 'Everything is stored in this browser only. Export a backup before closing or switching devices.'}</p><div class="adm-actions"><button type="button" class="outline" data-act="export">Export backup ↗</button><label class="outline adm-file">Import backup<input type="file" accept="application/json" hidden data-edit="import"></label><button type="button" class="outline" data-act="fresh">Clear sample data &amp; start fresh</button>${REMOTE ? '' : '<button type="button" class="outline" data-act="demo">Restore sample data</button>'}<button type="button" class="outline" data-act="password">Change password</button><button type="button" class="outline" data-act="lock">Lock control room</button></div>`;
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
            state = parsed; enqueue('replaceAll', { state: clone(parsed) }); adminSave('Backup imported.');
        }).catch(() => adminSay('Invalid backup file. Nothing changed.'));
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
    } else if (kind === 'kpi-name' || kind === 'kpi-weight') {
        const k = state.kpis.find(x => x.id === id);
        if (!k) return;
        if (kind === 'kpi-name') { if (!t.value.trim()) { renderAdmin(); return; } k.name = t.value.trim(); }
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
        const kpi = { id: newId('k', state.kpis), name: v.name.trim(), weight: w };
        state.kpis.push(kpi);
        enqueue('upsertKpi', { kpi: { ...kpi } });
        adminSave('KPI added.');
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
countdown();
setInterval(countdown, 60000);

render();
