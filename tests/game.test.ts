import { describe, expect, it } from 'vitest';
import { alive, newGame, score, type GameState } from '../src/game/state';
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
