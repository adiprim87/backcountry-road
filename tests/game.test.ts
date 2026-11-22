import { describe, expect, it } from 'vitest';
import { alive, daily, newGame, runSummary, score, type GameState } from '../src/game/state';
import { advanceDay, finishHunt, treatSick } from '../src/game/tick';
import { buy, unitPrice } from '../src/game/store';
import { TOTAL_MILES } from '../src/game/route';

const NAMES = ['Ann', 'Ben', 'Cal', 'Dot', 'Eli'];

function run(s: GameState, maxDays = 200) {
  for (let i = 0; i < maxDays && !s.result; i++) advanceDay(s);
  return s;
}

describe('travel loop', () => {
  it('grueling pace on bare rations kills the party before the fort', () => {
    const s = newGame('merchant', NAMES, 1);
    s.supplies.food = 200;
    s.pace = 'grueling';
    s.rations = 'bare';
    run(s);
    expect(s.result).toBe('lost');
    expect(alive(s)).toHaveLength(0);
    expect(s.miles).toBeLessThan(TOTAL_MILES);
  });

  it('steady pace with plenty of food reaches the fort', () => {
    const s = newGame('merchant', NAMES, 2);
    s.supplies.food = 2000;
    run(s);
    expect(s.result).toBe('won');
    expect(s.miles).toBe(TOTAL_MILES);
    expect(alive(s).length).toBeGreaterThan(0);
  });

  it('food never goes negative and starvation kills', () => {
    const s = newGame('merchant', NAMES, 3);
    s.supplies.food = 7;
    s.pace = 'rest';
    run(s);
    expect(s.supplies.food).toBe(0);
    expect(s.party.every((m) => m.cause === 'starvation')).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = newGame('farmer', NAMES, 42), b = newGame('farmer', NAMES, 42);
    a.supplies.food = b.supplies.food = 500;
    expect(run(a)).toEqual(run(b));
  });
});

describe('store', () => {
  it('charges money and rejects what you cannot afford', () => {
    const s = newGame('ranger', NAMES, 1);
    expect(buy(s, 'food', 5)).toBe(true);
    expect(s.supplies.food).toBe(50);
    expect(s.supplies.money).toBe(140);
    expect(buy(s, 'wheels', 100)).toBe(false);
    expect(s.supplies.money).toBe(140);
  });

  it('prices rise inland', () => {
    const s = newGame('merchant', NAMES, 1);
    const coast = unitPrice(s, 'wheels');
    s.at = 6;
    expect(unitPrice(s, 'wheels')).toBeGreaterThan(coast);
  });
});

import { cross, depth, risk } from '../src/game/river';
import { currentEvent, priceFactor, resolveEvent, rollEvent, startEvent } from '../src/game/events';
import { crossRisk } from '../src/game/river';

describe('rivers', () => {
  it('fording a high river goes wrong far more often than the ferry', () => {
    expect(risk('ford', 6)).toBeGreaterThan(risk('float', 6));
    expect(risk('float', 6)).toBeGreaterThan(risk('ferry', 6));
    const mishaps = (m: 'ford' | 'ferry') => {
      let n = 0;
      for (let seed = 0; seed < 300; seed++) {
        const s = newGame('merchant', NAMES, seed);
        s.at = 4; s.rain = 6; s.supplies.food = 100; s.supplies.money = 100;
        cross(s, m);
        if (s.supplies.food < 100) n++;
      }
      return n;
    };
    expect(mishaps('ford')).toBeGreaterThan(mishaps('ferry') * 5);
  });

  it('rain raises the river', () => {
    const s = newGame('merchant', NAMES, 1);
    s.at = 2;
    const dry = depth(s);
    s.rain = 4;
    expect(depth(s)).toBeGreaterThan(dry);
  });

  it('ferry needs the fare and Twelve Mile has none', () => {
    const s = newGame('merchant', NAMES, 1);
    s.at = 8; s.phase = 'river';
    cross(s, 'ferry');
    expect(s.phase).toBe('river');
  });
});

describe('events', () => {
  const broken = (role: 'merchant' | 'farmer' = 'merchant') => {
    const s = newGame(role, NAMES, 5);
    s.supplies.food = 300;
    s.pending = { id: 'break', target: 0, part: 'axles' };
    s.phase = 'event';
    return s;
  };

  it('a spare part fixes the wagon; without one that choice is disabled', () => {
    const s = broken();
    expect(currentEvent(s).choices[0].ok).toBe(false);
    resolveEvent(s, 0);
    expect(s.phase).toBe('event');
    s.supplies.axles = 1;
    resolveEvent(s, 0);
    expect(s.supplies.axles).toBe(0);
    expect(s.phase).toBe('travel');
  });

  it('treating the sick spends a dose on the sickest member', () => {
    const s = newGame('merchant', NAMES, 3);
    s.supplies.medicine = 1;
    Object.assign(s.party[1], { status: 'sick', health: 60 });
    Object.assign(s.party[3], { status: 'injured', health: 30 });
    treatSick(s);
    expect(s.party[3]).toMatchObject({ status: 'well', health: 40 });
    expect(s.party[1].status).toBe('sick');
    expect(s.supplies.medicine).toBe(0);
    treatSick(s); // no medicine left: nothing happens
    expect(s.party[1].status).toBe('sick');
  });

  it('each pack horse carries 100 lb more', () => {
    const s = newGame('merchant', NAMES, 3);
    expect(buy(s, 'packHorses')).toBe(true);
    s.supplies.food = 0; s.supplies.shot = 20;
    finishHunt(s, 250, 10);
    expect(s.supplies.food).toBe(200 - 15);
  });

  it('old saves without pack horses still load', () => {
    const s = newGame('farmer', NAMES, 1) as any;
    delete s.supplies.packHorses;
    localStorage.setItem('backcountry-road-save-v1', JSON.stringify(s));
    expect(load()!.supplies.packHorses).toBe(0);
  });

  it('abandoning the wagon loses the game', () => {
    const s = broken();
    resolveEvent(s, 2);
    expect(s.result).toBe('lost');
    expect(s.phase).toBe('end');
  });

  it('mending costs a day and either fixes it or keeps the event', () => {
    const s = broken('farmer');
    resolveEvent(s, 1);
    expect(s.day).toBe(1);
    expect(['travel', 'event']).toContain(s.phase);
  });

  it('once-only events fire once', () => {
    const s = newGame('merchant', NAMES, 1);
    s.at = 6; s.miles = 195;
    for (let i = 0; i < 200; i++) rollEvent(s);
    expect(s.seen.filter((id) => id === 'guide').length).toBeLessThanOrEqual(1);
  });

  it('every event renders and every choice resolves without throwing', async () => {
    const { EVENTS } = await import('../src/game/events');
    for (const e of EVENTS) for (let i = 0; i < e.choices.length; i++) {
      const s = newGame('merchant', NAMES, 9);
      Object.assign(s.supplies, { food: 200, shot: 50, medicine: 2, money: 50, wheels: 1, axles: 1, tongues: 1 });
      s.at = 6; s.miles = 195;
      s.rep.catawba = 2; // so the reputation-gated guide can set up
      startEvent(s, e.id);
      expect(currentEvent(s).text).not.toMatch(/undefined|NaN/);
      resolveEvent(s, i);
    }
  });
});

import { clearSave, load, save } from '../src/game/save';

describe('save', () => {
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  } as Storage;

  it('round-trips a game and resumes a hunt as travel', () => {
    const s = newGame('farmer', NAMES, 7);
    s.supplies.food = 300;
    run(s, 5);
    save(s);
    expect(load()).toEqual(s);
    s.phase = 'hunt';
    save(s);
    expect(load()!.phase).toBe('travel');
    clearSave();
    expect(load()).toBeNull();
  });

  it('repairs saves made mid-event by an older version', () => {
    const s = newGame('merchant', NAMES, 2);
    s.miles = 100; s.phase = 'event';
    s.pending = { id: 'catawba', target: 0 }; // trade event saved before offers existed
    save(s);
    const loaded = load()!;
    expect(() => currentEvent(loaded)).not.toThrow();
    expect(loaded.pending!.offer).toBeDefined();
    s.pending = { id: 'no-such-event', target: 0 };
    save(s);
    expect(load()).toMatchObject({ phase: 'travel', pending: undefined });
  });

  it('old saves without a difficulty load as normal', () => {
    const s = newGame('merchant', NAMES, 2) as Partial<GameState>;
    delete s.difficulty;
    save(s as GameState);
    expect(load()!.difficulty).toBe('normal');
  });

  it('ignores junk in storage', () => {
    localStorage.setItem('backcountry-road-save-v1', '{"nope":1}');
    expect(load()).toBeNull();
    localStorage.setItem('backcountry-road-save-v1', 'not json');
    expect(load()).toBeNull();
  });
});


describe('hunt payout and river stops', () => {
  it('caps meat at 100 lb, spends the shots and takes a day', () => {
    const s = newGame('ranger', NAMES, 3);
    Object.assign(s.supplies, { food: 50, shot: 20 });
    s.phase = 'hunt';
    finishHunt(s, 150, 7);
    expect(s.supplies.food).toBe(50 + 100 - 15); // a day's filling rations for 5
    expect(s.supplies.shot).toBe(13);
    expect(s.day).toBe(1);
    expect(s.phase).toBe('travel');
  });

  it('travel stops at a river and shows the crossing', () => {
    const s = newGame('merchant', NAMES, 3);
    s.supplies.food = 300;
    s.at = 1; s.miles = 54; // a mile short of the Edisto
    advanceDay(s);
    expect(s.miles).toBe(55);
    expect(s.phase).toBe('river');
  });
});

describe('trading and reputation', () => {
  const trader = (seed: number) => {
    const s = newGame('merchant', NAMES, seed);
    Object.assign(s.supplies, { food: 100, shot: 100, medicine: 10, money: 200 });
    s.miles = 100;
    return s;
  };

  it('offers are randomized per encounter', () => {
    const offers = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = trader(seed);
      startEvent(s, 'catawba');
      offers.add(JSON.stringify(s.pending!.offer));
    }
    expect(offers.size).toBeGreaterThan(10);
  });

  it('fair trades and gifts raise standing, which lowers later prices', () => {
    const s = trader(4);
    startEvent(s, 'catawba');
    resolveEvent(s, 1); // trade with a gift
    expect(s.rep.catawba).toBe(2);
    expect(priceFactor(s, 'catawba')).toBeLessThan(priceFactor(s, 'cherokee'));
    startEvent(s, 'catawba');
    expect(currentEvent(s).text).toMatch(/heard well of you/);
  });

  it('hard bargains cost standing and the next greeting says so', () => {
    const s = trader(5);
    s.rep.settlers = -2;
    startEvent(s, 'homestead');
    expect(currentEvent(s).text).toMatch(/wary/);
    resolveEvent(s, 2);
    expect(s.rep.settlers).toBeLessThan(-2);
  });

  it('a trusted guide offer only appears after earning trust', () => {
    const s = trader(6);
    for (let i = 0; i < 300; i++) rollEvent(s);
    expect(s.seen).not.toContain('scout');
  });

  it('a friendly people offer the guide, but not once the last river is crossed', () => {
    const s = trader(6);
    s.rep.catawba = 1;
    for (let i = 0; i < 300 && !s.seen.includes('scout'); i++) rollEvent(s);
    expect(s.seen).toContain('scout');
    const late = trader(6);
    late.rep.catawba = 3;
    late.miles = 275;
    for (let i = 0; i < 300; i++) rollEvent(late);
    expect(late.seen).not.toContain('scout');
  });

  it('big items: horses speed you up, the deed pays on arrival, the guide halves river risk', () => {
    const slow = trader(7), fast = trader(7);
    fast.owned.push('horses');
    slow.at = fast.at = 3; // past Orangeburg, so neither hits a landmark today
    advanceDay(slow); advanceDay(fast);
    expect(fast.miles).toBeGreaterThan(slow.miles);

    const s = trader(8);
    s.at = 4;
    const before = crossRisk(s, 'ford');
    s.owned.push('scout');
    expect(crossRisk(s, 'ford')).toBeCloseTo(before / 2);

    const a = trader(9), b = trader(9);
    a.result = b.result = 'won';
    b.owned.push('deed');
    expect(score(b) - score(a)).toBe(500);
  });

  it('buying a big item spends the rolled price', () => {
    const s = trader(10);
    startEvent(s, 'rifle');
    const price = s.pending!.offer!.giveQty;
    expect(price).toBeGreaterThanOrEqual(55);
    resolveEvent(s, 0);
    expect(s.owned).toContain('rifle');
    expect(s.supplies.money).toBe(200 - price);
  });
});

import { addScore, loadScores, type ScoreEntry } from '../src/game/scores';

describe('difficulty and high scores', () => {
  it('easy starts richer and hard poorer', () => {
    const money = (d: 'easy' | 'normal' | 'hard') => newGame('farmer', NAMES, 1, d).supplies.money;
    expect(money('easy')).toBeGreaterThan(money('normal'));
    expect(money('hard')).toBeLessThan(money('normal'));
  });

  it('hard brings more sickness than easy over the same days', () => {
    const sickDays = (d: 'easy' | 'hard') => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const s = newGame('merchant', NAMES, seed, d);
        s.supplies.food = 5000;
        s.pace = 'rest';
        for (let i = 0; i < 20; i++) { advanceDay(s); n += s.party.filter((m) => m.status === 'sick').length; }
      }
      return n;
    };
    expect(sickDays('hard')).toBeGreaterThan(sickDays('easy'));
  });

  it('keeps the best five scores, highest first', () => {
    const e = (score: number): ScoreEntry => ({ name: 'A', role: 'ranger', difficulty: 'normal', score, days: 30 });
    let list: ScoreEntry[] = [];
    for (const n of [300, 900, 100, 500, 700, 800]) list = addScore(list, e(n));
    expect(list.map((x) => x.score)).toEqual([900, 800, 700, 500, 300]);
  });

  it('drops stored score rows with the wrong shape', () => {
    localStorage.setItem('backcountry-road-scores-v1', JSON.stringify([
      { name: 'Ok', role: 'farmer', difficulty: 'hard', score: 900, days: 40 },
      { name: 'Bad', role: 'farmer', difficulty: 'hard', score: 800, days: '<img src=x onerror=alert(1)>' },
      null,
    ]));
    expect(loadScores().map((e) => e.name)).toEqual(['Ok']);
  });
});

import { answerQuiz, makeQuiz } from '../src/game/quiz';

describe('reckoning problems at landmarks', () => {
  it('arriving at a landmark sets a problem whose answer matches its working', () => {
    const s = newGame('merchant', NAMES, 4);
    s.supplies.food = 2000;
    while (s.at === 0) advanceDay(s);
    expect(s.quiz?.at).toBe(1);
    expect(s.quiz!.why).toContain(String(s.quiz!.answer));
  });

  it('every kind of problem is answerable, and a right answer pays once', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGame('farmer', NAMES, seed);
      s.at = 1 + (seed % 8);
      s.miles = 120;
      s.quiz = makeQuiz(s);
      kinds.add(s.quiz.q.split(' ').slice(0, 3).join(' '));
      expect(Number.isInteger(s.quiz.answer) && s.quiz.answer >= 0).toBe(true);
      const money = s.supplies.money;
      answerQuiz(s, s.quiz.answer);
      answerQuiz(s, s.quiz.answer);
      expect(s.supplies.money).toBe(money + 3);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it('a wrong answer costs nothing and cannot be retried', () => {
    const s = newGame('farmer', NAMES, 1);
    s.at = 2;
    s.quiz = makeQuiz(s);
    answerQuiz(s, s.quiz.answer + 1);
    answerQuiz(s, s.quiz.answer);
    expect(s.quiz.result).toBe('wrong');
    expect(s.supplies.money).toBe(180);
  });

  it('does not touch the game dice', () => {
    const a = newGame('farmer', NAMES, 9), b = newGame('farmer', NAMES, 9);
    makeQuiz(b);
    expect(b.rng).toBe(a.rng);
  });
});

import { canFish, finishFish } from '../src/game/river';

describe('fishing', () => {
  it('is free, spends no day, and works once per river', () => {
    const s = newGame('merchant', NAMES, 1);
    s.at = 2; s.miles = 55; s.phase = 'river';
    const day = s.day, shot = s.supplies.shot = 10;
    expect(canFish(s)).toBe(true);
    s.phase = 'fish';
    finishFish(s, 12);
    expect(s).toMatchObject({ phase: 'river', day, supplies: expect.objectContaining({ food: 12, shot }) });
    expect(canFish(s)).toBe(false);
    s.at = 4; // next river
    expect(canFish(s)).toBe(true);
  });

  it('a save made mid-fishing resumes at the river', () => {
    const s = newGame('merchant', NAMES, 1);
    s.at = 2; s.phase = 'fish';
    save(s);
    expect(load()!.phase).toBe('river');
  });
});

describe('journal and sharing', () => {
  it('the journal keeps every note with its day, while the on-screen log keeps 8', () => {
    const s = newGame('merchant', NAMES, 2);
    s.supplies.food = 2000;
    run(s);
    expect(s.log.length).toBeLessThanOrEqual(8);
    expect(s.journal.length).toBeGreaterThan(s.log.length);
    expect(s.journal[s.journal.length - 1]).toEqual({ day: s.day, text: s.log[0] });
    expect(s.journal.map((e) => e.day)).toEqual([...s.journal.map((e) => e.day)].sort((a, b) => a - b));
  });

  it('summarizes wins and losses', () => {
    const s = newGame('farmer', NAMES, 2, 'hard');
    s.supplies.food = 2000;
    run(s);
    expect(runSummary(s)).toMatch(new RegExp(`in ${s.day} days with \\d of 5 alive \\(Hard\\)\\. Score ${score(s)}`));
    const lost = newGame('farmer', NAMES, 3);
    lost.supplies.food = 7; lost.pace = 'rest';
    run(lost);
    expect(runSummary(lost)).toMatch(/ended at mile 0 of 300 after \d+ days \(Normal\)/);
  });
});

import { epilogue } from '../src/game/ending';

describe('daily challenge and endings', () => {
  it('the daily seed is the same all day (UTC) and changes the next day', () => {
    const a = daily(new Date('2026-11-22T00:30:00Z')), b = daily(new Date('2026-11-22T23:59:00Z'));
    expect(a).toEqual(b);
    expect(a.date).toBe('2026-11-22');
    expect(daily(new Date('2026-11-23T00:00:00Z')).seed).not.toBe(a.seed);
    const s = newGame('farmer', NAMES, a.seed);
    s.daily = a.date;
    s.result = 'won';
    expect(runSummary(s)).toMatch(/^Backcountry Road daily 2026-11-22: reached/);
  });

  it('the ending reflects survivors, the warrant, money and relations', () => {
    const s = newGame('merchant', NAMES, 1);
    s.result = 'won'; s.day = 40; s.supplies.money = 20;
    expect(epilogue(s)).toEqual([
      'All 5 of you walk through the gate of the fort together.',
      'You arrive with little but your wagon, and hire on as laborers at the fort.',
    ]);
    s.party.slice(1).forEach((m) => (m.status = 'dead'));
    s.owned.push('deed');
    s.rep.cherokee = 2;
    s.day = 25;
    const lines = epilogue(s).join(' ');
    expect(lines).toMatch(/only Ann arrives/);
    expect(lines).toMatch(/Long Canes Creek/);
    expect(lines).toMatch(/Cherokee friends/);
    expect(lines).toMatch(/fast passage/);
    s.result = 'lost';
    expect(epilogue(s)).toEqual(['The warrant for 200 acres on Long Canes Creek is never claimed.']);
  });
});

import { ART, PALETTE } from '../src/scenes/art';

describe('pixel art', () => {
  it('every sprite is a clean rectangle using only palette colors', () => {
    for (const [key, a] of Object.entries(ART)) {
      const pal = { ...PALETTE, ...a.pal };
      for (const row of a.rows) {
        expect(row.length, key).toBe(a.rows[0].length);
        for (const ch of row) expect(ch === '.' || ch in pal, `${key}: '${ch}'`).toBe(true);
      }
    }
  });
});
