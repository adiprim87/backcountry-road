import { alive, newGame, ROLES, score, type GameState, type Pace, type Rations, type Role } from '../game/state';
import { advanceDay, carryLimit, dateText, finishHunt } from '../game/tick';
import { currentEvent, resolveEvent } from '../game/events';
import { canCross, cross, depth, risk, waitRiver, type Method } from '../game/river';
import { clearSave, load, save } from '../game/save';
import { ROUTE, TOTAL_MILES } from '../game/route';
import { buy, ITEMS, unitPrice, type ItemKey } from '../game/store';

const DEFAULT_NAMES = ['Thomas', 'Mary', 'Johann', 'Sarah', 'Elias'];

let s: GameState | null = null;
let view: 'title' | 'outfit' = 'title';
let root: HTMLElement;
let scenesLoaded = false;

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const btn = (act: string, label: string, arg = '', disabled = false) =>
  `<button data-act="${act}" data-arg="${arg}"${disabled ? ' disabled' : ''}>${label}</button>`;
const healthWord = (h: number) => (h > 75 ? 'good' : h > 50 ? 'fair' : h > 25 ? 'poor' : 'very poor');
const select = (name: string, value: string, opts: string[]) =>
  `<select name="${name}">${opts.map((o) => `<option${o === value ? ' selected' : ''}>${o}</option>`).join('')}</select>`;

function title() {
  return `<h1>Backcountry Road</h1>
  <p>Charleston to Fort Prince George, 1756</p>
  <p>Lead a party of five three hundred miles from the coast into the South Carolina backcountry.
  Mind your food, your wagon and the rivers.</p>
  ${load() ? btn('continue', 'Continue') : ''}
  ${btn('outfit', 'New game')}
  <p class="note">Names, dates and distances are approximate.</p>`;
}

function outfit() {
  const roles = (Object.keys(ROLES) as Role[]).map((r, i) =>
    `<label class="row"><input type="radio" name="role" value="${r}"${i === 0 ? ' checked' : ''}>
     ${ROLES[r].label}: £${ROLES[r].money}. ${ROLES[r].perk}</label>`).join('');
  const names = DEFAULT_NAMES.map((n, i) =>
    `<label class="row">${i === 0 ? 'Leader' : `Companion ${i}`} <input name="member" value="${n}" maxlength="16" required></label>`).join('');
  return `<h2>Outfitting</h2>
  <p>${ROUTE[0].text}</p>
  <form><fieldset><legend>Who are you?</legend>${roles}</fieldset>
  <fieldset><legend>Your party</legend>${names}</fieldset>
  <button type="submit">Go to the store</button></form>`;
}

function store(g: GameState) {
  const rows = ITEMS.map((i) => {
    const p = unitPrice(g, i.key);
    return `<tr><td>${i.label}</td><td>£${p}</td><td>${g.supplies[i.key]}</td>
      <td>${btn('buy', '+1', `${i.key}:1`, p > g.supplies.money)} ${btn('buy', '+5', `${i.key}:5`, p * 5 > g.supplies.money)}</td></tr>`;
  }).join('');
  return `<h2>Store at ${ROUTE[g.at].name}</h2>
  <p>Money: £${g.supplies.money}. A party of ${alive(g).length} eats ${alive(g).length * 3} lb a day on filling rations.</p>
  <table><thead><tr><th>Item</th><th>Price</th><th>Have</th><th>Buy</th></tr></thead><tbody>${rows}</tbody></table>
  ${btn('travel', 'Leave the store')}`;
}

function ledger(g: GameState) {
  const next = ROUTE[g.at + 1];
  const party = g.party.map((m) =>
    `<li>${esc(m.name)}: ${m.status === 'dead' ? `dead (${m.cause})` : `${healthWord(m.health)}${m.status !== 'well' ? `, ${m.status}` : ''}`}</li>`).join('');
  return `<dl class="ledger">
    <dt>Date</dt><dd>${dateText(g.day)}</dd>
    <dt>Weather</dt><dd>${g.weather}</dd>
    <dt>Food</dt><dd>${g.supplies.food} lb</dd>
    <dt>Morale</dt><dd>${healthWord(g.morale)}</dd>
    <dt>Traveled</dt><dd>${g.miles} of ${TOTAL_MILES} mi</dd>
    <dt>Next</dt><dd>${next ? `${next.name}, ${next.mile - g.miles} mi` : '-'}</dd>
  </dl><ul class="party">${party}</ul>`;
}

function travel(g: GameState) {
  const here = ROUTE[g.at];
  const atStore = here.store && g.miles === here.mile;
  return `<h2>On the road</h2>${ledger(g)}
  <div class="controls">
    <label>Pace ${select('pace', g.pace, ['steady', 'strenuous', 'grueling', 'rest'])}</label>
    <label>Rations ${select('rations', g.rations, ['filling', 'meager', 'bare'])}</label>
  </div>
  ${btn('day', g.pace === 'rest' ? 'Rest a day' : 'Travel on')}
  ${btn('hunt', 'Go hunting (a day)', '', g.supplies.shot === 0)}
  ${atStore ? btn('store', `Visit the ${here.name} store`) : ''}
  ${log(g)}`;
}

const log = (g: GameState) => `<ol class="log" aria-live="polite">${g.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`;

function event(g: GameState) {
  const e = currentEvent(g);
  return `<h2>${dateText(g.day)}</h2><p class="event">${esc(e.text)}</p>
  ${e.choices.map((c, i) => btn('choose', esc(c.label), String(i), !c.ok)).join(' ')}
  ${log(g)}`;
}

const riskWord = (r: number) => (r < 0.08 ? 'low' : r < 0.25 ? 'moderate' : r < 0.5 ? 'high' : 'very high');

function river(g: GameState) {
  const here = ROUTE[g.at];
  const d = depth(g);
  const opt = (m: Method, label: string) => btn('cross', `${label} (risk: ${riskWord(risk(m, d))})`, m, !canCross(g, m));
  return `<h2>${here.name}</h2><p>${here.text}</p>
  <dl class="ledger"><dt>Depth</dt><dd>${d} ft</dd><dt>Weather</dt><dd>${g.weather}</dd>
  <dt>River gear</dt><dd>${g.supplies.riverGear}</dd><dt>Money</dt><dd>£${g.supplies.money}</dd></dl>
  <p>How will you cross?</p>
  ${opt('ford', 'Ford it')}
  ${opt('float', 'Caulk the wagon and float it')}
  ${here.ferry ? opt('ferry', `Take the ferry, £${here.ferry}`) : ''}
  ${btn('wait', 'Wait a day')}
  ${log(g)}`;
}

function hunt(g: GameState) {
  return `<h2>Hunting</h2><p>Click or tap game to shoot. Each shot uses one round (${g.supplies.shot} on hand).
  You can carry back ${carryLimit(g)} lb. Buy pack horses at a store to carry more.</p>`;
}

function landmark(g: GameState) {
  const here = ROUTE[g.at];
  return `<h2>${here.name}</h2><p>${here.text}</p>
  ${here.store ? btn('store', 'Visit the store') : ''} ${btn('travel', 'Continue')}`;
}

function end(g: GameState) {
  const dead = g.party.filter((m) => m.status === 'dead');
  return `<h2>${g.result === 'won' ? 'You made it' : 'Your journey has ended'}</h2>
  <p>${esc(g.endReason ?? '')}</p>
  <dl class="ledger"><dt>Days</dt><dd>${g.day}</dd><dt>Miles</dt><dd>${g.miles} of ${TOTAL_MILES}</dd>
  <dt>Survivors</dt><dd>${alive(g).length} of ${g.party.length}</dd>
  <dt>Food left</dt><dd>${g.supplies.food} lb</dd><dt>Money left</dt><dd>£${g.supplies.money}</dd>
  ${g.result === 'won' ? `<dt>Score</dt><dd>${score(g)}</dd>` : ''}</dl>
  ${dead.length ? `<p>Lost on the road:</p><ul>${dead.map((m) => `<li>${esc(m.name)}, ${m.cause}</li>`).join('')}</ul>` : ''}
  ${btn('again', 'Play again')}`;
}

function render() {
  if (!s) root.innerHTML = view === 'title' ? title() : outfit();
  else root.innerHTML = { store, travel, landmark, end, event, river, hunt }[s.phase](s);
  if (s?.phase === 'end') clearSave();
  else if (s && s.phase !== 'hunt') save(s);
  syncCanvas();
  root.querySelector<HTMLElement>('button:not([disabled]), input')?.focus({ preventScroll: true });
}

// Phaser (~1.2 MB) loads only once a game starts; the title screen doesn't need it.
function syncCanvas() {
  if (!s && !scenesLoaded) return;
  import('../scenes').then((m) => {
    scenesLoaded = true;
    // Decide from the state at load time, not when the import was requested.
    if (!s || s.phase === 'store' || s.phase === 'end') m.hideCanvas();
    else if (s.phase !== 'hunt') m.showMap(s.miles);
  });
}

function act(name: string, arg: string) {
  if (name === 'outfit') view = 'outfit';
  else if (name === 'continue') s = load();
  else if (name === 'again') { s = null; view = 'title'; }
  else if (s) {
    if (name === 'buy') { const [k, n] = arg.split(':'); buy(s, k as ItemKey, Number(n)); }
    else if (name === 'store') s.phase = 'store';
    else if (name === 'travel') s.phase = 'travel';
    else if (name === 'day') advanceDay(s);
    else if (name === 'choose') resolveEvent(s, Number(arg));
    else if (name === 'cross') cross(s, arg as Method);
    else if (name === 'wait') waitRiver(s);
    else if (name === 'hunt') {
      const g = s;
      g.phase = 'hunt';
      import('../scenes').then((m) => m.startHunt({ shots: g.supplies.shot, ranger: g.role === 'ranger', carry: carryLimit(g) }, (meat, used) => {
        finishHunt(g, meat, used);
        render();
      }));
    }
  }
  render();
}

export function mount(el: HTMLElement) {
  root = el;
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (b) act(b.dataset.act!, b.dataset.arg ?? '');
  });
  el.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (s && t.name === 'pace') s.pace = t.value as Pace;
    if (s && t.name === 'rations') s.rations = t.value as Rations;
    if (s && (t.name === 'pace' || t.name === 'rations')) {
      render();
      root.querySelector<HTMLElement>(`[name=${t.name}]`)?.focus(); // keep keyboard users in the select
    }
  });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const names = f.getAll('member').map((n, i) => String(n).trim() || DEFAULT_NAMES[i]);
    s = newGame(f.get('role') as Role, names);
    render();
  });
  render();
}
