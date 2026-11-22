# Backcountry Road: Spec

An original survival-journey game in the wagon-trail genre, set on the South Carolina frontier in spring 1756. It runs in the browser as a static site on GitHub Pages.

## Stack
- Vite + TypeScript + Phaser 3.90. No backend.
- `vite.config.ts` sets `base: './'`, so the site works under `https://<user>.github.io/<repo>/`.
- Game logic is pure TypeScript in `src/game/` with no DOM or Phaser, and Vitest tests it.
- Menus and the ledger are DOM screens. Phaser draws only the route map and the hunting mini-game.
- `.github/workflows/deploy.yml` builds, tests and deploys to Pages on every push to `main`.

## Route (~300 mi; mileages approximate)
| # | Landmark | Mile | Notes |
|---|----------|------|-------|
| 0 | Charleston | 0 | Start; full store |
| 1 | Dorchester | 25 | Small store |
| 2 | Edisto River | 55 | River crossing |
| 3 | Orangeburg | 85 | Store |
| 4 | Congaree River (Saxe-Gotha) | 120 | River crossing |
| 5 | Saluda River | 150 | River crossing |
| 6 | Ninety Six | 190 | Trading post; store |
| 7 | Long Canes | 225 | Settlement |
| 8 | Twelve Mile River | 270 | River crossing |
| 9 | Fort Prince George | 300 | Goal |

## Player setup
- **Role**:
  - Charleston merchant: £250 to start. Gets bargains from a Charleston factor on the road.
  - Backcountry farmer: £180, and repairs (their own and other settlers') succeed more often.
  - Ranger: £150, and hunting is better (bigger hit area, game moves slower).
- **Party**: a leader plus 4 named companions. Each has health from 0 to 100 and a status of well, sick, injured or dead.
- **Supplies**: food (lbs), powder and shot (shots), spare wheels, axles and tongues, medicine (doses), river gear (rope and caulking), and money (£).
- Prices go up the farther inland you buy.
- **Difficulty**:
  - Easy: 130% starting money, 80% as many events, half the sickness.
  - Normal: as described in this spec.
  - Hard: 80% starting money, 120% as many events, 2.5× the sickness.

## Daily loop
- **Pace**:
  - Rest: 0 miles a day.
  - Steady: 12 miles a day.
  - Strenuous: 16 miles a day.
  - Grueling: 22 miles a day.
  - The base miles are then multiplied by wagon condition and weather.
- **Rations**: filling (3 lb a person a day), meager (2 lb), or bare (1 lb).
- **Health**:
  - Faster pace, smaller rations, heat, bad weather and illness all lower it.
  - Resting and filling rations raise it.
  - A member dies when their health reaches 0.
  - With no food, everyone loses health quickly.
- **Morale** (0–100) changes with health, deaths and events. Low morale slows travel.
- The **bloody flux** (dysentery) can strike anyone on any day, less often while resting. Sick members lose health daily until they recover or you treat them with medicine.
- The ledger shows food as days left at current rations and warns when under 3 days.
- **Weather** changes each day: fair, hot and humid, rain, thunderstorm or fog. Rain raises the rivers.
- Each day there's a chance of one weighted random event, and landmarks have fixed events.

## Events (initial set, ~15)
- Fever or ague.
- Snakebite.
- Heat sickness.
- Swamp mosquitoes.
- A broken wheel, axle or tongue.
- A thunderstorm.
- Losing the trail.
- Spoiled food.
- A peddler.
- A Catawba trader (food for goods).
- A Cherokee guide, who offers a shortcut for a price.
- A militia patrol with news.
- Finding wild berries.
- A lost ox.
- A good camp.
- An abandoned cabin.

Events that reward particular play styles:
- A moonlit night march (fast paces only): miles for health.
- A buck at the creek: a quick shot for meat (rangers rarely miss).
- Wolves in the upcountry: spend powder or lose food.
- A sick traveler who pays £15 for a dose of medicine.
- A Charleston factor selling at coast prices (mostly to merchants).
- A settler's broken wagon: a day's help for food (farmers almost always succeed).
- A homestead clearing a field: a day's work for food (steady or resting parties).

Most events offer a choice with a trade-off, for example "use medicine or press on" or "repair now (uses a part) or limp along (slower)".

## Trading & reputation
- Trades with the Catawba, the Cherokee, settlers and traveling traders are rolled fresh each time: what they want, what they offer, and how much, within ±30%.
- Each trade offers four choices:
  - Trade fairly: standing +1.
  - Trade and add a gift (pay 1.5×): standing +2.
  - Drive a hard bargain (pay half): it may work at standing −2, or they leave at −1.
  - Decline politely.
- Standing runs from −3 (wary) to +3 (trusted) and moves prices from about 130% down to about 55%. Each group's greeting tells you where you stand, and the ledger lists your relations.
- Helping settlers, selling medicine to a sick traveler, and paying the Cherokee guide also raise standing.
- Once your standing with the Catawba or Cherokee is friendly (1 or more), a hunter may offer to guide you to the fort. The offer stops once the last river is behind you. Every river crossing is then half as risky.

## Rare big purchases (randomized price, offered once)
- Long rifle (£55–85): bigger hit area in hunts, and the creek buck almost never escapes.
- Horse team (£70–105): +4 miles a day at any travel pace.
- Land warrant for 200 acres on Long Canes Creek (£90–135): +500 score if you arrive. You'll be poorer for the rest of the trip.

## Reckoning problems
- Each landmark and river shows one optional word problem built from your real situation: how many days your food lasts, days left to the fort, the cost of several wheels, shillings in a pound, or money left after buying food.
- A right answer earns £3 and some morale. A wrong answer shows the working and costs nothing. You get one try per landmark.

## Rivers
- Each crossing has a depth and current, which rise with recent rain.
- The choices are:
  - Ford: free, and riskiest when the water is deep.
  - Caulk and float: uses river gear, medium risk.
  - Ferry: costs £, low risk.
  - Wait a day: the water may fall.
- A failed crossing can lose supplies, damage the wagon or injure someone.

## Hunting
- A 30-second Phaser scene with deer, turkey, rabbits and wild boar moving through the pines.
- Click or tap to shoot. Each shot uses one powder and shot.
- You can carry back 100 lb of meat, plus 100 lb per pack horse. The hunt ends on its own once you hit that limit.
- Each shot and hit makes a short sound.

## Ending
- **Win**: reach Fort Prince George with at least one member alive.
  - Score = survivors × 100 + total health + supplies value − days taken.
- **Lose**:
  - Everyone has died.
  - Or the wagon is broken with no spare part, no money, and no store nearby.
- The end screen shows a run summary (days, miles, deaths with their causes, score) and a Play Again button.

## Saving
- The game autosaves to `localStorage` at the end of each day.
- The title screen offers Continue (if there's a save) or New Game.
- Storage errors are caught and ignored, so the game still works in private browsing.
- The 5 best winning runs (leader, role, difficulty, days, score) are kept in `localStorage`. They show on the title screen and the end screen, with the new run highlighted.

## Sound
- Short WebAudio beeps, no audio files: shots and hits in the hunt, a chime when an event starts, a low note when someone dies, and a tune for winning or losing.
- A Sound on/off button sits on the title screen and the road screen. The browser remembers the choice.

## Tone & history
- The look is a green-on-black terminal ledger with monospace type and light scanlines.
- Cherokee and Catawba people appear as traders, guides and bearers of news. There are no raids or caricatures.
- Charleston's opening text acknowledges that the colony's wealth rested on enslaved labor. Slavery is never turned into a game mechanic.
- Names, dates and distances are approximate, and a notes line in the game says so.

## Out of scope (for now)
- Music.
- Online or shared high scores.
- Multiple routes.
