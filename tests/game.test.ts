import { describe, expect, it } from 'vitest';
import { alive, newGame, type GameState } from '../src/game/state';
import { advanceDay, finishHunt } from '../src/game/tick';
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
    expect(alive(s).length).toBe(5);
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
    expect(s.supplies.money).toBe(110);
    expect(buy(s, 'wheels', 100)).toBe(false);
    expect(s.supplies.money).toBe(110);
  });

  it('prices rise inland', () => {
    const s = newGame('merchant', NAMES, 1);
    const coast = unitPrice(s, 'wheels');
    s.at = 6;
    expect(unitPrice(s, 'wheels')).toBeGreaterThan(coast);
  });
});

import { cross, depth, risk } from '../src/game/river';
import { currentEvent, resolveEvent, rollEvent } from '../src/game/events';

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
      s.pending = { id: e.id, target: 1, part: 'wheels' };
      s.phase = 'event';
      expect(currentEvent(s).text.length).toBeGreaterThan(0);
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
