# Stage 7: Eksperiment for de 5 fejlede grupper — implementeringsplan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afgøre for gruppe 18, 40, 41, 53 og 54 fra `s7-run1`, om fejlen er reel, skyldes belastning, er ustabil eller uafgjort, med faste regler over målte data.

**Architecture:** En lille Node-harness uden for repoet (`%TEMP%\wsdk-s7-exp1\harness`) kører hver gruppe som en separat børneproces via den eksisterende `runGroupedSelectedSources` fra worktree'en `%TEMP%\wsdk-pr48` @ `785b533`. Driveren mærker hver kørsel med belastning, logger kun tal og faste koder til `log.jsonl` og afgør udfald med en ren beslutningsfunktion.

**Tech Stack:** Node v26.13.1 (ESM, kun built-ins), `node:test`, PowerShell `Get-CimInstance` til proces- og CPU-måling. Ingen npm-installation.

Spec: `docs/specs/2026-11-19-stage7-failed-groups-experiment-design.md`.

## Global Constraints

- Kun læsning mod AddOns-mappen. Receipts må aldrig ligge under AddOns-roden.
- Log, rapport og chat må ikke indeholde lokale stier, brugernavne eller tredjeparts filnavne — kun gruppenumre, faste koder og tal.
- Repoet, PR #48/#51/#52 og #11's acceptpolitik ændres ikke. Den fulde enkeltkørsel forbliver primær accept.
- `%TEMP%\wsdk-s7-pergroup-run1` røres ikke.
- Kun den ældre profil (`wow-sdk-selected-graph-e0fd1a1-*`) bruges.
- Kørsler er sekventielle; andre sessioner kører videre og måles i stedet for at forudsættes væk.
- Rapporten postes på #11 kun efter udtrykkeligt ja.

**Commits:** Harness-koden ligger uden for repoet og committes ikke. Denne plan og specen committes kun med udtrykkeligt ja. "Commit"-trinnet i hver opgave er derfor erstattet af en tjekliste-afkrydsning.

## Fil-kort (alle foreslåede, under `%TEMP%\wsdk-s7-exp1\`)

| Fil | Ansvar |
| --- | --- |
| `config.json` | Lokale absolutte stier (AddOns-rod, worktree, profilmappe). Læses kun; udskrives aldrig. |
| `harness/config.mjs` | Indlæser config, bygger request præcis som CLI'en, udvælger én gruppe. |
| `harness/scrub.mjs` | Stiscanning af al tekst før den skrives eller vises. |
| `harness/decide.mjs` | Ren beslutningsfunktion: log-rækker → udfald pr. gruppe + støjbund. |
| `harness/run-one.mjs` | Børneproces: én gruppe, én gentagelse, fejlklasse-fangst, ét JSON-resultat på stdout. |
| `harness/load.mjs` | Belastningsmærkat (andre grafprocesser + CPU). |
| `harness/experiment.mjs` | Driver: plan, genoptagelse, tidsgrænse, receipts-placering, log. |
| `harness/report.mjs` | Tabel ud fra log + `decide`. |
| `harness/*.test.mjs` | Fokuserede tests pr. modul. |
| `exp-NNN/receipts/` | Én receipts-mappe pr. kørsel. |
| `log.jsonl`, `report.md` | Resultater (kun tal og koder). |

Observerede grænseflader i worktree'en (læst 2026-11-19):

- `scripts/selected-source-grouped.mjs:180` — `runGroupedSelectedSources({root, request, receiptDirectory, runtimeId = '', resume = true, prepare, createHost, analyze, fingerprint, now})` → `{report, exitCode}`. Skriver `group-0001.json` (completed) eller `group-0001.failed.json` for en request med én gruppe. `code` er `null`, når den kastede fejl ikke har en gyldig streng-kode (`:205`).
- `scripts/selected-source-grouped.mjs:39` — `groupDigest(request, group, runtimeId)`.
- `scripts/inspect-selected-addon-sources-by-group.mjs:44-45` — request bygges som `{profile: graph, environment, selectionPolicy, conditionPolicy, xmlPolicy, inlineProfile, luaInputProfile}`; `xmlPolicy = validateXmlProviderProfile(...)`, `inlineProfile = validateXmlInlineProfile(...)`; `luaInputProfile` er `'corpus-files'` eller `'bounded'`.
- Profilmappen indeholder `graph-profile-private.json` (100 `addons` med `logicalAddonId, directory, addonBaseName, tocPaths`), `resolution-profile-private.json`, `xml-profile-private.json`, `inline-profile-private.json`.
- Run1-receipts: `group-NNNN.json` har felterne `index, digest, outcome, aggregate{status,…}, durationMilliseconds, parentPeakRssKiB`.

Test-kommando for alle opgaver: `node --test "$env:TEMP\wsdk-s7-exp1\harness"` (PowerShell).

---

### Task 1: Request-bygning der matcher run1

**Files:**

- Create: `harness/config.mjs`, `harness/config.test.mjs`, `config.json`

**Interfaces:**

- Consumes: `validateXmlProviderProfile`, `validateXmlInlineProfile`, `prepareGraphContext`, `groupDigest` fra worktree'en (importeret via `pathToFileURL(join(worktree, 'scripts', …))`).
- Produces:
  - `loadConfig(file) → {addonsRoot, worktree, profileDirectory}`
  - `async buildRequest(config, luaInputProfile) → request`
  - `singleGroupRequest(request, groupNumber) → request` (gruppenummer 1-baseret; `profile.addons = [addons[groupNumber - 1]]`)
  - `async detectLuaInputProfile(config, run1Directory) → 'corpus-files' | 'bounded'`

- [ ] **Step 1: Failing test.** `config.test.mjs`:
  - `singleGroupRequest(req, 18).profile.addons` har længde 1 og er `req.profile.addons[17]` (syntetisk request med 3 addons; gruppe 4 kaster `RangeError`, gruppe 0 kaster `RangeError`).
  - `detectLuaInputProfile` mod en syntetisk run1-mappe: skriv `group-0001.json` med `digest = groupDigest(reqBounded, addons[0], 's7-run1')` → returnerer `'bounded'`; med digest for `corpus-files` → `'corpus-files'`; med en fremmed digest → kaster `Error` med `code: 'exp-digest-mismatch'`.
- [ ] **Step 2:** Kør testkommandoen. Forventet: fejl `Cannot find module …config.mjs`.
- [ ] **Step 3: Implementér.** `buildRequest` gentager `inspect-selected-addon-sources-by-group.mjs:41-45` ordret og kalder `prepareGraphContext(request)`. `detectLuaInputProfile` læser `group-0001.json` (eller den første `group-NNNN.json`) i run1, beregner digest for begge varianter med runtime-id `s7-run1` og returnerer den der matcher. `config.json` udfyldes med de lokale stier (AddOns-roden fra handoff-pakken; profilmappen er `%TEMP%\wow-sdk-selected-graph-e0fd1a1-*`).
- [ ] **Step 4:** Testkommandoen. Forventet: alle `config.test.mjs` består.
- [ ] **Step 5: Integrationstjek (kun profillæsning, ingen AddOns-læsning).** `node -e` der kalder `detectLuaInputProfile` mod den rigtige run1-mappe og udskriver kun resultatet. Forventet: `corpus-files` eller `bounded`. Ved `exp-digest-mismatch`: stop og spørg brugeren (resultater ville ikke kunne sammenlignes med run1).
- [ ] **Step 6:** Afkryds.

### Task 2: Stiscanning

**Files:**

- Create: `harness/scrub.mjs`, `harness/scrub.test.mjs`

**Interfaces:**

- Produces: `makeScrubber({addonsRoot, worktree, profileDirectory, addonNames}) → (text) => text` — returnerer teksten uændret eller kaster `Error` med `code: 'exp-path-leak'`. `addonNames` = alle `directory` og `addonBaseName` fra graph-profilen.

- [ ] **Step 1: Failing test.** Afvises (case-insensitivt): tekst med `\Users\`, `/Users/`, AddOns-roden med `\` og `/`, worktree-stien, profilmappen, et af `addonNames`. Accepteres: `{"group":40,"code":null,"errorName":"Error"}`, `graph-native-attributes`, `SGRAPH0007`. Et addon-navn kortere end 4 tegn matches kun som helt ord (undgår falske positive på fx `UI`).
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér som en liste af escaped regex-mønstre.
- [ ] **Step 4:** Forventet: består.
- [ ] **Step 5:** Ingen integration endnu.
- [ ] **Step 6:** Afkryds.

### Task 3: Beslutningsregler

**Files:**

- Create: `harness/decide.mjs`, `harness/decide.test.mjs`

**Interfaces:**

- Consumes: log-rækker `{group, rep, outcome: 'completed'|'failed'|'harness-timeout', code: string|null, phase: string|null, errorName: string|null, load: 'low'|'high'}`.
- Produces: `decide(rows, {targets: [18,40,41,53,54], controls: [1,23]}) → {noisy: boolean, groups: {[group]: {verdict: 'reel'|'belastning'|'ustabil'|'uafgjort', lowLoadRuns: number}}}`.

Regler (fra specen, evalueres i denne rækkefølge pr. målgruppe):

1. Fejlsignatur = `code`, hvis ikke-null; ellers `phase + ':' + errorName`; `harness-timeout` har ingen signatur.
2. **reel**: én signatur forekommer ≥ 2 gange, mindst én af dem med `load: 'low'`, og ingen række er `completed` med `load: 'low'`.
3. **belastning**: ≥ 1 `completed` med `load: 'low'`, og alle ikke-`completed` har `load: 'high'`.
4. **ustabil**: både `completed` og ikke-`completed` forekommer med `load: 'low'`.
5. **uafgjort**: alt andet.
6. **noisy** = en kontrolgruppe har ikke samme `outcome` i alle sine rækker. Når `noisy`, ændres hvert `reel` til `ustabil`.

- [ ] **Step 1: Failing test.** Én test pr. regel plus:
  - fejl(lav, A), fejl(høj, A), completed(lav) → `ustabil` (ikke `reel`).
  - fejl(lav, A), fejl(lav, B), completed(høj) → `uafgjort`.
  - tre `harness-timeout` med lav belastning → `uafgjort`.
  - gruppe 40-signatur: to rækker `code:null, phase:'analyze', errorName:'Error'` (én lav) → `reel`.
  - kontrol 23 med completed, completed, failed → `noisy: true`, og et ellers `reel` bliver `ustabil`.
  - gruppe med færre end 3 rækker afgøres stadig (genoptagelse kan efterlade huller); `lowLoadRuns` tæller korrekt.
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér som ren funktion uden I/O.
- [ ] **Step 4:** Forventet: alle består.
- [ ] **Step 5:** Ingen integration.
- [ ] **Step 6:** Afkryds.

### Task 4: Børneproces `run-one.mjs` med fejlklasse-fangst

**Files:**

- Create: `harness/run-one.mjs`, `harness/run-one.test.mjs`

**Interfaces:**

- Consumes: `buildRequest`, `singleGroupRequest` (Task 1); `runGroupedSelectedSources` (worktree).
- Produces:
  - `async runOne({root, request, receiptDirectory, runtimeId, seams = {}}) → {outcome: 'completed'|'failed', code, groupStatus: 'passed'|'incomplete'|'failed'|null, phase, errorName, hasValidCode, durationMilliseconds, parentPeakRssKiB}`
  - CLI: `node run-one.mjs <configFile> <luaInputProfile> <groupNumber> <runDirectory> <runtimeId>` → én JSON-linje på stdout, exit 0 (også når gruppen fejler); exit 2 ved ugyldig input, og så kun teksten `run-one input invalid` på stderr.

Adfærd:

- `wrap(phaseName, fn)` returnerer en funktion, der kalder `fn`; ved kast gemmes første fejl som `{phase: phaseName, errorName: error?.name ?? 'unknown', hasValidCode: typeof error?.code === 'string'}`, og fejlen kastes videre uændret. Gælder `prepare`, `createHost`, `analyze`. Bemærk: runneren kalder `prepare` én gang på hele requesten før løkken (`:184`); en fejl dér stopper runneren helt og fanges af `runOne`'s egen `try`, som så returnerer `outcome: 'failed', code: 'exp-runner-threw'`.
- `resume: false` altid.
- Efter kørslen læses `group-0001.json` eller `group-0001.failed.json` i `receiptDirectory`. `outcome`, `code`, `durationMilliseconds`, `parentPeakRssKiB` tages fra kvitteringen; `groupStatus` = `aggregate.status` for completed, ellers `null`.
- `phase`/`errorName`/`hasValidCode` er `null`, når intet blev kastet.
- Al stdout går gennem scrubberen fra Task 2.
- (Anbefaling, ikke i specen:) `groupStatus` logges, fordi 77 af run1's 95 gennemførte grupper havde `aggregate.status: 'failed'` (`faulted`). Det skal ikke indgå i beslutningsreglerne, men gør det muligt at se det senere.

- [ ] **Step 1: Failing test.** Med en midlertidig mappe (`fs.mkdtempSync`) som både `root` og et selvforfattet addon-træ (`Fixture\Fixture.toc`, `Fixture\a.lua` med eget indhold), en syntetisk request med én addon `{directory: 'Fixture', …}`, og seams:
  - `prepare: () => ({})`, `createHost: async () => ({})`, `analyze: async () => {throw new Error('x')}` → resultat `outcome:'failed', code:null, phase:'analyze', errorName:'Error', hasValidCode:false`, og kvitteringsfilen `group-0001.failed.json` har `code: null` (runnerens adfærd uændret). Dette er spec-verifikation 2.
  - `analyze` kaster `Object.assign(new Error(), {code: 'graph-native-attributes'})` → `code:'graph-native-attributes', hasValidCode:true`.
  - Med samme seams som `tests/selected-source-grouped.test.mjs:29-35` (`prepare: () => ({})`, `createHost: async () => ({})`) og et `analyze`, der returnerer testfilens `counts('passed')`-aggregat → `outcome:'completed', groupStatus:'passed'`, `phase:null`. `fingerprint` injiceres ikke, så den rigtige `fingerprintGroup` hasher det selvforfattede træ.
  - Stdout fra CLI'en indeholder ikke den midlertidige mappes sti.
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér.
- [ ] **Step 4:** Forventet: består.
- [ ] **Step 5: Integration.** Kør `run-one.mjs` CLI'en mod det selvforfattede træ (ikke AddOns). Forventet: én JSON-linje, exit 0.
- [ ] **Step 6:** Afkryds.

### Task 5: Belastningsmærkat

**Files:**

- Create: `harness/load.mjs`, `harness/load.test.mjs`

**Interfaces:**

- Produces:
  - `classifyProcesses(processes, {addonsRoot, selfPid}) → number` — ren funktion; `processes = [{pid, commandLine}]`; tæller dem, hvis `commandLine` (case-insensitivt) indeholder `addonsRoot` eller `selected-source`, eksklusive `selfPid`.
  - `async sampleLoad({addonsRoot}) → {graphProcs: number, cpuPercent: number}` — kører `powershell.exe -NoProfile -Command` med `Get-CimInstance Win32_Process | Select ProcessId,CommandLine | ConvertTo-Json` og to målinger af `(Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average` med 1 s imellem; `cpuPercent` = gennemsnit, afrundet.
  - `loadLabel(before, after) → 'low'|'high'` — `low` kun hvis `graphProcs === 0` og `cpuPercent < 80` både før og efter (grænsen hævet fra 50 % til 80 % 2026-11-19, se specen).
- Kommandolinjer gemmes aldrig; kun antallet returneres.

- [ ] **Step 1: Failing test.** `classifyProcesses`: MCP-node-processer uden match → 0; én med AddOns-roden i anden casing → 1; én med `selected-source` → 1; egen pid ekskluderes; `commandLine: null` tælles ikke. `loadLabel`: grænsetilfælde `cpuPercent: 80` → `high`; `graphProcs: 1` kun efter → `high`.
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér. Fejler PowerShell-kaldet, returneres `{graphProcs: -1, cpuPercent: -1}`, og `loadLabel` giver `high` (ukendt belastning er aldrig lav).
- [ ] **Step 4:** Forventet: består.
- [ ] **Step 5: Integration.** `node -e` der kalder `sampleLoad` og udskriver kun de to tal. Forventet: `graphProcs` ≥ 0, `cpuPercent` 0–100.
- [ ] **Step 6:** Afkryds.

### Task 6: Driver `experiment.mjs`

**Files:**

- Create: `harness/experiment.mjs`, `harness/experiment.test.mjs`

**Interfaces:**

- Consumes: `loadConfig`, `detectLuaInputProfile` (Task 1); `makeScrubber` (Task 2); `sampleLoad`, `loadLabel` (Task 5); CLI'en `run-one.mjs` (Task 4).
- Produces:
  - `planRuns(groups, repetitions) → [{run, group, rep}]` — round-robin: `run` 1..N, først alle grupper med `rep 1`, så `rep 2`, så `rep 3`.
  - `async runExperiment({configFile, experimentDirectory, groups = [18,40,41,53,54,1,23], repetitions = 3, timeoutMilliseconds = 600000, spawnRunOne = defaultSpawn, sample = sampleLoad}) → {completedRuns, skippedRuns}`
  - CLI: `node experiment.mjs <configFile> <experimentDirectory>`.

Adfærd:

1. **Receipts-placering:** `path.resolve(experimentDirectory)` må ikke starte med `path.resolve(addonsRoot) + path.sep` (case-insensitivt på Windows) og må ikke være lig med den. Ellers kast `code: 'exp-receipts-inside-addons'` før noget andet sker.
2. `luaInputProfile = detectLuaInputProfile(...)` én gang.
3. **Genoptagelse:** læs eksisterende `log.jsonl`; kørsler, hvis `run` allerede findes, springes over. En ufuldstændig sidste linje (crash midt i skrivning) ignoreres og overskrives ikke — den nye linje tilføjes efter et linjeskift.
4. Pr. kørsel: `before = sample()`; opret ny `exp-NNN\receipts` (fejler, hvis mappen findes — `fs.mkdirSync` uden `recursive` på det sidste led, så en gammel kvittering aldrig genbruges; findes den fra en afbrudt kørsel, omdøbes den til `exp-NNN.aborted-<timestamp>` først); spawn `run-one.mjs` med runtime-id `s7-exp1-NNN`; ved overskridelse af `timeoutMilliseconds`: `taskkill /T /F /PID <pid>` og `outcome: 'harness-timeout'`, øvrige felter `null`; `after = sample()`.
5. Byg log-rækken `{run, group, rep, outcome, code, groupStatus, phase, errorName, hasValidCode, durationMilliseconds, parentPeakRssKiB, loadBefore, loadAfter, load: loadLabel(before, after)}`, kør den gennem scrubberen, og tilføj den til `log.jsonl` med `fs.appendFileSync`.
6. Børneprocessens stderr kasseres (den kan indeholde stier); exit ≠ 0 og ingen gyldig JSON → `outcome: 'failed', code: 'exp-child-invalid'`.

- [ ] **Step 1: Failing test.** Med injiceret `spawnRunOne` og `sample` (ingen PowerShell, ingen AddOns):
  - `planRuns([18,40], 2)` → `[{1,18,1},{2,40,1},{3,18,2},{4,40,2}]`.
  - `experimentDirectory` under en syntetisk AddOns-rod → kaster `exp-receipts-inside-addons`, og intet er oprettet.
  - Genoptagelse: log med kørsel 1–2 + en halv linje → kun kørsel 3–4 udføres; den halve linje er urørt; resultatet har 4 parsebare linjer efter den halve.
  - Fake spawn der aldrig afslutter + `timeoutMilliseconds: 50` → række med `outcome: 'harness-timeout'`, og kill-funktionen blev kaldt med børnenes pid.
  - Fake resultat med en sti i `errorName` → scrubberen kaster `exp-path-leak`, og intet skrives til loggen.
  - Eksisterende `exp-001` → omdøbes til `exp-001.aborted-*`, ny `exp-001` oprettes.
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér.
- [ ] **Step 4:** Forventet: består.
- [ ] **Step 5: Integration (spec-verifikation 1).** Tørløb af den rigtige CLI med en config, der peger på det selvforfattede træ fra Task 4, `groups = [1]`, `repetitions = 2`; afbryd processen efter første linje i `log.jsonl` og start igen. Forventet: 2 linjer i alt, ingen sti i nogen fil under `experimentDirectory` uden for `exp-*\receipts` (tjek med scrubberen).
- [ ] **Step 6:** Afkryds.

### Task 7: Rapport

**Files:**

- Create: `harness/report.mjs`, `harness/report.test.mjs`

**Interfaces:**

- Consumes: `decide` (Task 3), `makeScrubber` (Task 2).
- Produces: `renderReport(rows) → string` (Markdown), CLI `node report.mjs <configFile> <experimentDirectory>` → skriver `report.md`.

Indhold: én tabel `Gruppe | Udfald | Kode / fejlklasse | Median tid (s) | Median RSS (MiB) | Kørsler med lav belastning`, i rækkefølgen 18, 40, 41, 53, 54, derefter kontrollerne 1 og 23 med deres udfald pr. gentagelse; en linje med `Støjbund: ren` eller `Støjbund: støjende — reel nedgraderet til ustabil`; en linje med antal kørsler og antal `harness-timeout`. Kode-kolonnen viser den hyppigste signatur. Medianer beregnes kun over rækker med ikke-null værdier; ingen sådanne → `–`.

- [ ] **Step 1: Failing test.** Syntetiske rækker → forventet Markdown ordret for én ren og én støjende case; tom log → `Ingen kørsler.`; rapporten passerer scrubberen.
- [ ] **Step 2:** Forventet fejl: modul mangler.
- [ ] **Step 3:** Implementér.
- [ ] **Step 4:** Forventet: består.
- [ ] **Step 5:** Kør rapport-CLI'en på tørløbets log fra Task 6. Forventet: `report.md` med én gruppe.
- [ ] **Step 6:** Afkryds.

### Task 8: Kør eksperimentet mod installationen

**Files:**

- Create (data): `%TEMP%\wsdk-s7-exp1\log.jsonl`, `exp-001…exp-021\receipts\`, `report.md`

- [ ] **Step 1: Gate.** Alle tests består: `node --test "$env:TEMP\wsdk-s7-exp1\harness"`. Tørløbet fra Task 6 Step 5 er bestået. Task 1 Step 5 gav en entydig `luaInputProfile`. Ellers: stop.
- [ ] **Step 2: Start frakoblet.** Start driveren i baggrunden med citerede stier (handoff-erfaring: ucitarede stier med mellemrum giver `Invalid selected-source graph input`):
  `Start-Process node -ArgumentList '"<harness>\experiment.mjs"','"<config.json>"','"<experimentDirectory>"' -WindowStyle Hidden -RedirectStandardError "<experimentDirectory>\driver-stderr.txt"`. Gem pid i `driver-pid.txt`.
- [ ] **Step 3: Vent** på 21 linjer i `log.jsonl` med en baggrundsventer (ikke polling i forgrunden). Dør driveren før 21 linjer: start igen med samme kommando (genoptagelse).
- [ ] **Step 4: Rapport.** `node report.mjs …`; vis `report.md` til brugeren.
- [ ] **Step 5: Kontrol.** Scrubberen på `log.jsonl` og `report.md` består; antal linjer = 21; antal `exp-NNN`-mapper (uden `.aborted`) = 21.
- [ ] **Step 6: Gate.** Spørg brugeren, om rapporten skal postes på #11. Post kun ved ja.

---

## Uafklarede, eksternt synlige beslutninger

- **`luaInputProfile`**: afgøres af digest-matchet i Task 1. Matcher ingen variant, er det en beslutning for brugeren, om eksperimentet skal køre alligevel (resultaterne kan så ikke sammenlignes direkte med run1).
- **Posting af rapporten på #11**: kun efter udtrykkeligt ja (Task 8 Step 6).
- **Commit af spec og plan**: kun efter udtrykkeligt ja.

## Uden for denne plan

- De 77 gennemførte grupper med `aggregate.status: 'failed'` (`faulted`) i run1 er et selvstændigt fund, der ikke er forklaret. Det logges via `groupStatus`, men analyseres ikke her.
- SGRAPH0007-fasen i gruppe 23 og klassificering af afvisninger er senere eksperimenter.
