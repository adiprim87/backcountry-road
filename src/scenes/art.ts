// Pixel art as text: each character is one pixel, '.' is transparent. All art faces right.
// Turned into textures at runtime (sprites.ts), so the game ships no image files.

export const PALETTE: Record<string, string> = {
  k: '#1a120b', // outline
  w: '#e8e0c8', // wagon canvas
  b: '#8a5a2b', // wood
  d: '#5a3a1e', // dark wood, antlers, hat
  t: '#c8a070', // tan: deer, skin, planks
  o: '#a06a3a', // ox
  g: '#4f9a4f', // grass, reeds
  p: '#1f4a24', // pine
  r: '#d94a3a', // red: roofs, float, flag
  W: '#f0f0f0', // white
  n: '#2a4a7a', // coat
  y: '#d8c040', // turkey legs, bream
  h: '#5a4a3a', // boar
  f: '#f0e8d8', // tail
  c: '#a89878', // rabbit
  s: '#b8b8b8', // silver
  L: '#c8e0f0', // rain, splash
};

export interface Art { rows: string[]; px: number; pal?: Record<string, string> }

const wagon = (wheel: string): string[] => [
  '..kkkkkkkk..........',
  '.kwwwwwwwwk.........',
  'kwwwwwwwwwwk........',
  'kwwwwwwwwwwk....kk..',
  'kwwwwwwwwwwk...kook.',
  'kbbbbbbbbbbbk.kooook',
  'kddddddddddddkoooook',
  '.kkk....kkk...oo..oo',
  `${wheel}..${wheel}..oo..oo`,
  '.kkk....kkk...k...k.',
];

const deerBody = [
  '...........d.d..',
  '...........d.d..',
  '............dd..',
  '...........tttt.',
  '...........ttkt.',
  '...........ttttk',
  '..tttttttttttt..',
  '.ttttttttttttt..',
  'ftttttttttttt...',
  '.ttttttttttt....',
];
const turkeyBody = [
  'd.d.d.......',
  'dbdbd.......',
  '.dbdbd...rr.',
  '.ddbdd..rWk.',
  '..ddddd.rr..',
  '..ddddddd...',
  '...dddddd...',
  '....dddd....',
];
const rabbitBody = [
  '......c.c.',
  '......c.c.',
  '......ccc.',
  '..cccccckc',
  '.ccccccccc',
  'fcccccccc.',
  '.cccccccc.',
];
const boarBody = [
  '..h.h.h.......',
  '.hhhhhhhhhh...',
  'hhhhhhhhhhhhh.',
  'hhhhhhhhhhkhh.',
  'hhhhhhhhhhhhtt',
  '.hhhhhhhhhhhW.',
  '.hhhhhhhhhhh..',
];
const fish = [
  'y...ggg...',
  'yy.ggggg..',
  'yyggggkgg.',
  'yy.ggggg..',
  'y...ggg...',
];

export const ART: Record<string, Art> = {
  // Map
  wagon0: { px: 2, rows: wagon('kdtdk') },
  wagon1: { px: 2, rows: wagon('ktdtk') },
  house: { px: 2, rows: [
    '....r....',
    '...rrr...',
    '..rrrrr..',
    '.rrrrrrrr',
    '..ttttt..',
    '..tdtkt..',
    '..tdttt..',
    '..tdttt..',
  ] },
  fort: { px: 2, rows: [
    '.....k.....',
    '.....rr....',
    '.....rrr...',
    '.....k.....',
    'd.d.dkd.d.d',
    'ddddddddddd',
    'dbdbdbdbdbd',
    'dbdbdbdbdbd',
    'dbdbkkbdbdb',
    'ddddkkddddd',
  ] },
  tree: { px: 2, rows: [
    '..p..',
    '.ppp.',
    '..p..',
    '.ppp.',
    'ppppp',
    '..d..',
  ] },
  // Hunt
  pine: { px: 4, rows: [
    '.....p.....',
    '....ppp....',
    '...ppppp...',
    '....ppp....',
    '...ppppp...',
    '..ppppppp..',
    '...ppppp...',
    '..ppppppp..',
    '.ppppppppp.',
    '..ppppppp..',
    '.ppppppppp.',
    'ppppppppppp',
    '.....d.....',
    '.....d.....',
    '.....d.....',
  ] },
  grass: { px: 3, rows: ['g.g.g', '.ggg.', 'ggggg'] },
  deer0: { px: 3, rows: [...deerBody, '..t.t.....t.t...', '..t.t.....t.t...', '..k.k.....k.k...'] },
  deer1: { px: 3, rows: [...deerBody, '...tt.....tt....', '..t..t...t..t...', '.k....k.k....k..'] },
  turkey0: { px: 3, rows: [...turkeyBody, '.....y.y....', '.....y.y....', '....yy.yy...'] },
  turkey1: { px: 3, rows: [...turkeyBody, '.....y..y...', '....y...y...', '...yy...yy..'] },
  rabbit0: { px: 3, rows: [...rabbitBody, '..c....c..'] },
  rabbit1: { px: 3, rows: [...rabbitBody, '.c......c.'] },
  boar0: { px: 3, rows: [...boarBody, '..h.h...h.h...', '..k.k...k.k...'] },
  boar1: { px: 3, rows: [...boarBody, '.h...h.h...h..', 'k...k.k...k...'] },
  // Fishing
  float: { px: 4, rows: ['..k..', '.rrr.', 'rrrrr', 'rrrrr', 'WWWWW', 'WWWWW', '.WWW.', '..k..'] },
  angler: { px: 5, rows: [
    '...dddd...',
    '..dddddd..',
    '...tttt...',
    '...ttkt...',
    '....tt....',
    '..nnnnnt..',
    '.nnnnnn...',
    '.nnnnnn...',
    '.nnnnnndd.',
    '..nnnnnddd',
    '..kk...kk.',
  ] },
  reeds: { px: 4, rows: ['.d..d', '.d.dd', '.g.dg', 'gg.gg', '.g.g.', '.ggg.', '..g..', '..g..'] },
  bream: { px: 3, rows: fish },
  shad: { px: 4, rows: fish, pal: { g: '#b8c8d0', y: '#8898a8' } },
  catfish: { px: 5, rows: fish, pal: { g: '#5a5a4a', y: '#3a3a30' } },
  sturgeon: { px: 8, rows: fish, pal: { g: '#7a6a5a', y: '#5a4a3a' } },
  // River crossing
  drop: { px: 2, rows: ['L', 'L', 'L'] },
  crate: { px: 4, rows: ['kkkkk', 'kbdbk', 'kdbdk', 'kbdbk', 'kkkkk'] },
  raft: { px: 6, rows: ['bdbdbdbdbdbdbdbdbdbdbdbd', 'dddddddddddddddddddddddd', '.k...k...k...k...k...k..'] },
  // Map weather and event pictures
  sun: { px: 3, rows: ['....y....', '.y.....y.', '...yyy...', '..yyyyy..', 'y.yyyyy.y', '..yyyyy..', '...yyy...', '.y.....y.', '....y....'] },
  moon: { px: 3, rows: ['..WWW..', '.WWW...', 'WWW....', 'WWW....', 'WWW....', '.WWW...', '..WWW..'] },
  cloud: { px: 3, pal: { s: '#8a8a9a' }, rows: [
    '....sss.....',
    '..sssssss...',
    '.sssssssss..',
    'ssssssssssss',
    '.ssssssssss.',
    '.....yy.....',
    '....yy......',
    '.....yy.....',
    '......y.....',
  ] },
  snake: { px: 3, pal: { g: '#7a8a3a' }, rows: ['.........gg.', '........gkgr', '..gg....gg..', '.g..g..g....', 'g....gg.....'] },
  wheel: { px: 3, rows: ['..kkkkk..', '.kb.b.bk.', 'kb..b..bk', 'k.b.b.b.k', 'kbbbdbbbk', 'k.b.b.b.k', 'kb..b..bk', '.kb.b.bk.', '..kkkkk..'] },
  horse: { px: 3, rows: [
    '..........oo..',
    '.........ooko.',
    '..wwww...oooo.',
    '.wwwwww.ooo...',
    '.oooooooooo...',
    'oooooooooo....',
    'd.oooooooo....',
    '..o.o...o.o...',
    '..o.o...o.o...',
    '..k.k...k.k...',
  ] },
  wolf: { px: 3, pal: { s: '#8a8a8a' }, rows: [
    '..........s.s.',
    '..........sss.',
    '.........sssks',
    's.ssssssssssss',
    '.ssssssssss...',
    '..ssssssss....',
    '..s.s...s.s...',
    '..k.k...k.k...',
  ] },
  bottle: { px: 3, rows: ['..kk..', '..tt..', '..ww..', '.wwww.', 'wnnnnw', 'wnWWnw', 'wnnnnw', 'wnnnnw', '.wwww.'] },
  berries: { px: 3, rows: ['..g.g.g..', '.ggrgggg.', 'grggggrgg', 'ggggrgggg', 'grgggggrg', '.gggrggg.', '..ggggg..'] },
  fire: { px: 3, rows: ['....r....', '...ryr...', '..ryyr...', '..ryyyr..', '.ryyWyyr.', '..ryyyr..', 'dbdbdbdbd', '.d.b.d.b.'] },
  mosquito: { px: 3, rows: ['.W.....W.', '..W...W..', '...WhW...', 'hhhhhhhk.', '..h.h.h..', '.h..h..h.'] },
  barrel: { px: 3, rows: ['.dddddd.', 'dbbbbbbd', 'kkkkkkkk', 'dbbbbbbd', 'dbbbbbbd', 'dbbbbbbd', 'kkkkkkkk', 'dbbbbbbd', '.dddddd.'] },
  rifle: { px: 3, rows: ['k...............', 'bbbbbkkkkkkkkkkk', 'bbbbbbd.........', '.bbb..k.........'] },
  scroll: { px: 3, rows: ['dwwwwwwwwd', '.wwwwwwww.', '.wkkkkkkw.', '.wwwwwwww.', '.wkkkkkww.', '.wwwwwwww.', '.wwwwwrrw.', 'dwwwwwwrwd'] },
};

// A small picture for each event, from the same pixel art the canvas scenes use.
export const EVENT_PIC: Record<string, string> = {
  fever: 'bottle', sickTraveler: 'bottle', snakebite: 'snake', heat: 'sun', mosquitoes: 'mosquito', break: 'wheel', storm: 'cloud',
  lost: 'pine', guide: 'pine', scout: 'pine', spoiled: 'barrel', factor: 'barrel', peddler: 'horse', catawba: 'horse',
  cherokeeTrade: 'horse', militia: 'horse', horses: 'horse', homestead: 'house', cabin: 'house', harvest: 'house',
  berries: 'berries', camp: 'fire', nightMarch: 'moon', deer: 'deer0', wolves: 'wolf', settlerWagon: 'wagon0', rifle: 'rifle', deed: 'scroll',
};
