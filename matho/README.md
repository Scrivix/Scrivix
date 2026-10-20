# MATHO

One game engine, with separate question-set data. Start at [the chooser](./).
The shared caller, teacher room and student board are in `game/`.
Addition and exponent folders contain compatibility redirects only.

## Source layout

- `game/app.js`: caller and classroom presentation.
- `game/room.js`: live teacher room, authoritative board assignment and claim checks.
- `game/student.js`: student board, markings, call sound and result messages.
- `game/live-core.js`: board generation, five winning patterns and claim rules.
- `game/question-set.js`: set-specific connection keys, saved-game keys, links and hints.
- `game/boot.js`: loads the selected set, applies instructions, and starts the appropriate shared page.
- `sets/index.json`: the landing-page catalogue.
- `sets/<id>.json`: title, instructions, hints and bank filename.
- `sets/<id>-bank.json`: questions, answers, column letters and enabled flags.
- `style.css` and `live.css`: shared layout and responsive styling.
- `auto-draw.js`, `call-sound.js`, `result-panel.js`, `results.css`: shared timer, sound and celebration features.

The URL parameter `set` chooses the question set, for example:
`game/?set=addition`, `game/room.html?set=addition`, and `game/join.html?set=addition&room=ABCDEFGH`.
The classroom view adds `view=display`.

## Adding a question set

1. Add `sets/<id>.json`, using an existing metadata file as a template. Change `id`, `title`, `bankFile`, instructions, hints and export filename. Use a lowercase slug such as `multiplication`.
2. Omit `storagePrefix` for a new set. Its storage, classroom channel and connection names will automatically be isolated. Existing prefixes are compatibility settings; do not change them for addition or exponents.
3. Add `sets/<id>-bank.json`. Each entry has `id`, `letter` (M, A, T, H or O), LaTeX `question` and `answer` strings, and an `enabled` boolean. Optional `note` appears in the teacher bank editor. Escape backslashes for JSON.
4. Add the set's card to `sets/index.json`, with the same slug. `sample` is trusted, source-controlled display HTML.
5. Validate at least five distinct enabled answers in each column (four in T, because the center is free). Open the shared caller, host and student links to verify the set.

No new game scripts, HTML pages, or edition folder are needed. Change game behavior once in the shared files.

## Compatibility and play

Existing addition/exponent caller, teacher and student links redirect while preserving room codes and presentation parameters. Their saved-game, student-session, room and sound keys retain their previous values. Questions, confirmed corrections and exclusions are unchanged.

A live host must keep its teacher tab open and laptop awake. PeerJS Cloud introduces browsers; some school networks block the direct connection. Local hosting does not bypass network isolation. Up to 60 students can join.

Teacher answers are hidden on the classroom and student screens. Student pages load instructions and connection metadata; they do not load the answer bank. Teacher-hosted state sends only public called questions and that student's board and result. Banks are static website assets, not protected examination material.

All five patterns, optional call/claim sounds, automatic draws, optional incorrect-mark counts, and winner messages use the shared engine. Student result messages can be closed or fade after 10 seconds. Classroom announcements can be dismissed by the teacher.

Run locally using the supplied launcher or a static HTTP server. MathJax and fonts require internet access; multiplayer also needs signaling and a permitted browser-to-browser connection.

## Verification

The retained source workspace includes `math-bingo/tests/`. From its parent directory, run `node math-bingo/tests/run.cjs`.
Tests cover exact question-bank preservation, column ranges, all five win patterns, unique boards, legacy links and saved-state recovery, set isolation, loader failures, student-bank separation, timers, sounds, claims and private feedback, student reconnection and classroom results.
