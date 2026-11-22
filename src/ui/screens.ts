import { alive, DIFFICULTY, newGame, ROLES, score, type Difficulty, type GameState, type Group, type Pace, type Rations, type Role } from '../game/state';
import { advanceDay, carryLimit, dateText, finishHunt, foodDays, treatSick } from '../game/tick';
import { currentEvent, GROUP_NAME, mood, OWNED_LABEL, resolveEvent } from '../game/events';
import { canCross, cross, crossRisk, depth, waitRiver, type Method } from '../game/river';
import { clearSave, load, save } from '../game/save';
import { ROUTE, TOTAL_MILES } from '../game/route';
import { buy, ITEMS, unitPrice, type ItemKey } from '../game/store';
import { loadScores, recordScore, type ScoreEntry } from '../game/scores';
import { isMuted, sfx, toggleMute } from '../sound';
import { answerQuiz, QUIZ_REWARD } from '../game/quiz';

const DEFAULT_NAMES = ['Thomas', 'Mary', 'Johann', 'Sarah', 'Elias'];

let s: GameState | null = null;
let view: 'title' | 'outfit' = 'title';
let root: HTMLElement;
let scenesLoaded = false;
// Remembered between renders: which run's score was recorded, and what changed since the last render (for sounds).
let recorded: { run: GameState; entry: ScoreEntry; list: ScoreEntry[] } | null = null;
let last = { run: null as GameState | null, phase: '', dead: 0 };

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
  ${soundBtn()}
  ${scores(loadScores())}
  <p class="note">Names, dates and distances are approximate.</p>`;
}

const soundBtn = () => btn('sound', isMuted() ? 'Sound: off' : 'Sound: on');

function scores(list: ScoreEntry[], mine?: ScoreEntry) {
  if (!list.length) return '';
  const rows = list.map((e) => `<tr${e === mine ? ' class="mine"' : ''}><td>${esc(e.name)}</td><td>${esc(String(e.role))}</td>
    <td>${DIFFICULTY[e.difficulty]?.label ?? ''}</td><td>${e.days}</td><td>${e.score}</td></tr>`).join('');
  return `<h2>Best journeys</h2><table class="scores"><thead><tr><th>Leader</th><th>Role</th><th>Level</th><th>Days</th><th>Score</th></tr></thead>
  <tbody>${rows}</tbody></table>`;
}

function outfit() {
  const roles = (Object.keys(ROLES) as Role[]).map((r, i) =>
    `<label class="row"><input type="radio" name="role" value="${r}"${i === 0 ? ' checked' : ''}>
     ${ROLES[r].label}: £${ROLES[r].money}. ${ROLES[r].perk}</label>`).join('');
  const names = DEFAULT_NAMES.map((n, i) =>
    `<label class="row">${i === 0 ? 'Leader' : `Companion ${i}`} <input name="member" value="${n}" maxlength="16" required></label>`).join('');
  const levels = (Object.keys(DIFFICULTY) as Difficulty[]).map((d) =>
    `<label class="row"><input type="radio" name="difficulty" value="${d}"${d === 'normal' ? ' checked' : ''}> ${DIFFICULTY[d].label}</label>`).join('');
  return `<h2>Outfitting</h2>
  <p>${ROUTE[0].text}</p>
  <form><fieldset><legend>Who are you?</legend>${roles}</fieldset>
  <fieldset><legend>Difficulty</legend>${levels}
  <p class="note">Easy: more money, less sickness and fewer events. Hard: less money, more sickness and more events.</p></fieldset>
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
  <table class="store"><thead><tr><th>Item</th><th>Price</th><th>Have</th><th>Buy</th></tr></thead><tbody>${rows}</tbody></table>
  ${btn('travel', 'Leave the store')}`;
}

function ledger(g: GameState) {
  const next = ROUTE[g.at + 1];
  const party = g.party.map((m) =>
    `<li>${esc(m.name)}: ${m.status === 'dead' ? `dead (${m.cause})` : `${healthWord(m.health)}${m.status !== 'well' ? `, ${m.status}` : ''}`}</li>`).join('');
  return `<dl class="ledger">
    <dt>Date</dt><dd>${dateText(g.day)}</dd>
    <dt>Weather</dt><dd>${g.weather}</dd>
    <dt>Food</dt><dd>${g.supplies.food} lb (~${foodDays(g)} days)${foodDays(g) < 3 ? ' LOW' : ''}</dd>
    <dt>Morale</dt><dd>${healthWord(g.morale)}</dd>
    <dt>Traveled</dt><dd>${g.miles} of ${TOTAL_MILES} mi</dd>
    <dt>Next</dt><dd>${next ? `${next.name}, ${next.mile - g.miles} mi` : '-'}</dd>
    ${relations(g)}
    ${g.owned.length ? `<dt>Owned</dt><dd>${g.owned.map((o) => OWNED_LABEL[o]).join(', ')}</dd>` : ''}
  </dl><ul class="party">${party}</ul>`;
}

/** Standing with each people you've dealt with (hidden until it moves off neutral). */
function relations(g: GameState) {
  const known = (Object.keys(GROUP_NAME) as Group[]).filter((k) => g.rep[k] !== 0);
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  return known.length ? `<dt>Relations</dt><dd>${known.map((k) => `${cap(GROUP_NAME[k])} ${mood(g.rep[k])}`).join(', ')}</dd>` : '';
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
  ${alive(g).some((m) => m.status !== 'well') ? btn('treat', `Treat the sick (${g.supplies.medicine} doses)`, '', g.supplies.medicine === 0) : ''}
  ${atStore ? btn('store', `Visit the ${here.name} store`) : ''}
  ${soundBtn()}
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
  const opt = (m: Method, label: string) => btn('cross', `${label} (risk: ${riskWord(crossRisk(g, m))})`, m, !canCross(g, m));
  return `<h2>${here.name}</h2><p>${here.text}</p>
  <dl class="ledger"><dt>Depth</dt><dd>${d} ft</dd><dt>Weather</dt><dd>${g.weather}</dd>
  <dt>River gear</dt><dd>${g.supplies.riverGear}</dd><dt>Money</dt><dd>£${g.supplies.money}</dd></dl>
  ${g.owned.includes('scout') ? '<p>Your guide knows these fords. Every crossing is safer.</p>' : ''}
  <p>How will you cross?</p>
  ${opt('ford', 'Ford it')}
  ${opt('float', 'Caulk the wagon and float it')}
  ${here.ferry ? opt('ferry', `Take the ferry, £${here.ferry}`) : ''}
  ${btn('wait', 'Wait a day')}
  ${quiz(g)}
  ${log(g)}`;
}

function hunt(g: GameState) {
  return `<h2>Hunting</h2><p>Click or tap game to shoot. Each shot uses one round (${g.supplies.shot} on hand).
  You can carry back ${carryLimit(g)} lb. Buy pack horses at a store to carry more.</p>`;
}

/** The optional reckoning problem at a landmark. */
function quiz(g: GameState) {
  const z = g.quiz;
  if (!z || z.at !== g.at) return '';
  const body = !z.result
    ? `<form data-form="quiz" class="row"><label>Answer <input name="answer" type="number" inputmode="numeric" required></label>
       <button type="submit">Check</button></form>`
    : z.result === 'right' ? `<p>Right: ${z.answer}. You earn £${QUIZ_REWARD}.</p>` : `<p>Not quite. ${esc(z.why)}</p>`;
  return `<fieldset class="quiz"><legend>Reckoning (optional, £${QUIZ_REWARD} if right)</legend><p>${esc(z.q)}</p>${body}</fieldset>`;
}

function landmark(g: GameState) {
  const here = ROUTE[g.at];
  return `<h2>${here.name}</h2><p>${here.text}</p>
  ${here.store ? btn('store', 'Visit the store') : ''} ${btn('travel', 'Continue')}
  ${quiz(g)}`;
}

function end(g: GameState) {
  const dead = g.party.filter((m) => m.status === 'dead');
  return `<h2>${g.result === 'won' ? 'You made it' : 'Your journey has ended'}</h2>
  <p>${esc(g.endReason ?? '')}</p>
  <dl class="ledger"><dt>Days</dt><dd>${g.day}</dd><dt>Miles</dt><dd>${g.miles} of ${TOTAL_MILES}</dd>
  <dt>Survivors</dt><dd>${alive(g).length} of ${g.party.length}</dd>
  <dt>Food left</dt><dd>${g.supplies.food} lb</dd><dt>Money left</dt><dd>£${g.supplies.money}</dd>
  ${g.result === 'won' ? `<dt>Score</dt><dd>${score(g)}</dd>` : ''}</dl>
  ${g.result === 'won' && g.owned.includes('deed') ? '<p>Your land warrant for 200 acres on Long Canes Creek is good. You have a home on the frontier. (+500 score)</p>' : ''}
  ${dead.length ? `<p>Lost on the road:</p><ul>${dead.map((m) => `<li>${esc(m.name)}, ${m.cause}</li>`).join('')}</ul>` : ''}
  ${recorded?.run === g ? scores(recorded.list, recorded.entry) : ''}
  ${btn('again', 'Play again')}`;
}

/** Once per finished run: put a win on the score table. */
function recordEnd(g: GameState) {
  if (g.result !== 'won' || recorded?.run === g) return;
  const entry: ScoreEntry = { name: g.party[0].name, role: g.role, difficulty: g.difficulty, score: score(g), days: g.day };
  recorded = { run: g, entry, list: recordScore(entry) };
}

function playSounds() {
  const dead = s ? s.party.length - alive(s).length : 0;
  // Skip the first render of a run (a continued save shouldn't replay old news).
  if (s && last.run === s) {
    if (s.phase === 'end' && last.phase !== 'end') (s.result === 'won' ? sfx.won : sfx.lost)();
    else if (dead > last.dead) sfx.death();
    else if (s.phase === 'event' && last.phase !== 'event') sfx.event();
  }
  last = { run: s, phase: s?.phase ?? '', dead };
}

function render() {
  if (s?.phase === 'end') recordEnd(s);
  playSounds();
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
  else if (name === 'sound') toggleMute();
  else if (s) {
    if (name === 'buy') { const [k, n] = arg.split(':'); buy(s, k as ItemKey, Number(n)); }
    else if (name === 'store') s.phase = 'store';
    else if (name === 'travel') s.phase = 'travel';
    else if (name === 'day') advanceDay(s);
    else if (name === 'treat') treatSick(s);
    else if (name === 'choose') resolveEvent(s, Number(arg));
    else if (name === 'cross') cross(s, arg as Method);
    else if (name === 'wait') waitRiver(s);
    else if (name === 'hunt') {
      const g = s;
      g.phase = 'hunt';
      import('../scenes').then((m) => m.startHunt({ shots: g.supplies.shot, ranger: g.role === 'ranger', rifle: g.owned.includes('rifle'), carry: carryLimit(g) }, (meat, used) => {
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
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    if (form.dataset.form === 'quiz') {
      if (s) answerQuiz(s, Number(f.get('answer')));
      render();
      return;
    }
    const names = f.getAll('member').map((n, i) => String(n).trim() || DEFAULT_NAMES[i]);
    s = newGame(f.get('role') as Role, names, Date.now(), (f.get('difficulty') ?? 'normal') as Difficulty);
    render();
  });
  render();
}
