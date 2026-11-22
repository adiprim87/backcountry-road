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
};
