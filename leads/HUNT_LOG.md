# Hunt Log

One line per `/hunt` run, newest at the top. `/hunt` appends to this file as
the last step of every run — never edit past rows by hand, this is a record.

| Date & time | Country | Added | Running total (country) | Rejected (major reasons) |
|---|---|---|---|---|
| 2026-08-01 20:51 | USA | 22 (re-pass) | USA 39 / 500 quota | Methodology fix, not a new search: re-verified the 13 firms dropped in the prior run purely for being large/famous, using a light single-fetch pass instead of excluding by size. Only 8 stayed out — genuine fetch failures on retry (Bergmeyer, Ballinger, Bernardon, KSS, Digsau, Gnome, Atrium, Ann Beha — 403/cert-error/503/connection-refused twice each), plus L2P (absorbed into Stantec, already on the mega-brand skip list). Playbook §4 and §5 rewritten: size no longer excludes, only a named list of ~13 globally-iconic brands does; verification now runs at two speeds (light/deep) chosen per candidate. Added leads/SOURCE_LEDGER.md to track which of the ~35 sources have been used per country, so future runs rotate instead of defaulting to the same 2-3. |
| 2026-08-01 20:25 | USA | 17 | USA 17 / 500 quota | Large/famous firms (Gensler, NBBJ, Stantec, Jacobs, EwingCole, Payette, Sasaki, Elkus Manfredi, KieranTimberlake, Ballinger) — in-house 3D likely, hard sale; 2 firms blocked by fetch network restrictions (Digsau, Moto Designshop); 1 firm 503 (Gnome Architects); "Urban" NYC hiring-viz lead dropped — couldn't confirm which real company the listing belonged to; Charlap Hyman & Herrero domain didn't resolve; Urban Architecture Studio turned out to be India-based, not the NYC match intended |
| 2026-08-01 20:06 | — | — | UK 9 · UAE 7 · Denmark 3 · Saudi Arabia 3 · Norway 1 · Sweden 1 · Qatar 1 = **25** | — |

*(baseline row above — reflects the state after the playbook/restructure, before the log existed)*
