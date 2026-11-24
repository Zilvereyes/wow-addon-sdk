# Stage 7: Eksperiment for de 5 fejlede grupper (design)

Dato: 2026-11-19 · Issue: #11 (stage 7) · Status: design godkendt i dialog, afventer review af denne fil

## Formål

Afgøre for hver af de fem grupper, der kastede i per-gruppe-kørslen `s7-run1` (gruppe 18, 40, 41, 53, 54), om fejlen er **reel**, skyldes **belastning**, er **ustabil**, eller er **uafgjort** — mens andre sessioner fortsat læser samme AddOns-installation.

Metoden er auto-researchs keep/discard-løkke, men hvor "keep" afgøres af faste regler over målte data, ikke af selvvurdering.

## Udgangspunkt (målt 2026-11-19)

- `s7-run1` batch: status `failed`, 100 grupper, 95 completed, 5 threw, 0 resumed; 5 af 95 `completeUnderPolicy`.
- Gruppe 18, 41, 53, 54: `graph-native-attributes`. Gruppe 40: `code: null` (runneren gemmer `null`, når den kastede fejl ikke har en gyldig streng-kode, `scripts/selected-source-grouped.mjs:205`); varighed 228 s mod typisk 55–110 s.
- SGRAPH0007 (2 forekomster) ligger udelukkende i gruppe 23, som også har 2 worker-fejl. Fase ikke isoleret — uden for dette eksperiment, men gruppe 23 bruges som kontrol.
- Afvisninger i de 95 grupper: 1 Lua, 13 XML, 6 TOC. De 6 XML, der mangler i forhold til den fulde kørsels 19, formodes at ligge i de 5 fejlede grupper (ubekræftet).

## Ikke-mål

- Ingen ændring af repoet, PR #48/#51/#52 eller #11's acceptpolitik. Den fulde enkeltkørsel forbliver primær accept.
- Ingen isolering af SGRAPH0007-fasen og ingen klassificering af afvisninger (senere eksperimenter).
- Ingen instrumentering af runneren i PR-grenen (kan foreslås bagefter, hvis gruppe 40 er reel).

## Begrænsninger

- Kun læsning mod AddOns-mappen. Receipts må aldrig ligge inde i den.
- Output (log, rapport, chat) må ikke indeholde lokale stier, brugernavne eller tredjeparts filnavne — kun gruppenumre, faste koder og tal.
- Andre sessioner kører videre; belastning måles i stedet for at forudsættes væk.
- Kørsler er sekventielle, aldrig parallelle.

## Arkitektur

Alt ligger i `%TEMP%\wsdk-s7-exp1\`. Worktree `%TEMP%\wsdk-pr48` @ `785b533` bruges read-only som kodekilde. `%TEMP%\wsdk-s7-pergroup-run1` røres ikke.

### 1. Eksperimentdriver (`experiment.mjs`) og kørselsproces (`run-one.mjs`)

- `experiment.mjs` styrer plan, belastningsmærkat, tidsgrænse og log. Hver kørsel startes som en separat børneproces `node run-one.mjs <group> <rep>`, så den kan afbrydes ved tidsgrænsen, og så hukommelse ikke ophobes mellem kørsler. `parentPeakRssKiB` er dermed børneprocessens eget maksimum.
- `run-one.mjs` importerer `runGroupedSelectedSources` fra worktree'en og skriver ét JSON-resultat (kun tal og koder) til stdout.
- Indlæser den ældre private profil (`…e0fd1a1…`); den nyere med `limits`-nøglen bruges ikke.
- Pr. kørsel: request med præcis én gruppe; eget katalog `exp-NNN\receipts`; `runtimeId: "s7-exp1-NNN"`; `resume: false`.
- Kørselsplan: grupper `[18, 40, 41, 53, 54, 1, 23]` × 3 gentagelser, round-robin (alle 7 én gang, så alle 7 igen, osv.) = 21 kørsler.

### 2. Fejlklasse-fangst

`prepare`, `createHost` og `analyze` sendes som indpakkede seams. Ved en kastet fejl noteres `{phase, errorName, hasValidCode}`, og fejlen kastes videre uændret. Fejlbeskeder, stakke og stier logges aldrig. Kvitteringens `code` skal være identisk med hvad runneren ville have skrevet uden indpakning.

### 3. Belastningsmærkat

Målt umiddelbart før og efter hver kørsel:

- `graphProcs`: antal andre processer (eksklusive driverens egen pid og børn), hvis kommandolinje indeholder AddOns-roden eller `selected-source`. Kun antallet gemmes.
- `cpuPercent`: systemets samlede CPU-belastning (gennemsnit over 2 s).

**Lav belastning** = `graphProcs == 0` både før og efter, og `cpuPercent < 80` både før og efter. Alt andet er **høj**. (Ændret fra 50 % efter tørløbet: baggrunds-CPU uden grafkørsler målt til 40–91 %; besluttet af brugeren 2026-11-19.)

At tælle `node.exe` generelt bruges ikke: ca. 25 MCP-/Codex-node-processer kører konstant.

### 4. Log (`log.jsonl`)

Én linje pr. kørsel (illustrative værdier, ikke målt):

```json
{"run":9,"group":40,"rep":2,"outcome":"failed","code":null,"phase":"analyze","errorName":"Error","hasValidCode":false,
 "durationMilliseconds":120000,"parentPeakRssKiB":200000,
 "loadBefore":{"graphProcs":0,"cpuPercent":31},"loadAfter":{"graphProcs":1,"cpuPercent":64},"load":"high"}
```

`outcome` ∈ `completed | failed | harness-timeout`.

## Beslutningsregler

Afgøres pr. gruppe efter alle 3 gentagelser, i denne rækkefølge:

1. **reel**: samme ikke-null `code` (eller for gruppe 40: samme `phase` + `errorName`) i ≥ 2 af 3, mindst én af disse kørsler har `load: "low"`, og ingen kørsel er `completed` med `load: "low"`.
2. **belastning**: mindst én `completed` med `load: "low"`, og alle fejl har `load: "high"`.
3. **ustabil**: både `completed` og fejl forekommer med `load: "low"`.
4. **uafgjort**: alt andet (fx ingen kørsel med lav belastning).

**Støjbund:** Hvis kontrolgruppe 1 eller 23 ikke har samme `outcome` i alle 3 gentagelser, markeres eksperimentet `noisy`, og alle `reel` nedgraderes til `ustabil`.

`harness-timeout` tæller som fejl, men aldrig som "samme kode".

## Fejlhåndtering

- **Genoptagelse:** ved genstart springes kørsler, der allerede har en linje i `log.jsonl`, over; næste kørsel får nyt katalog. Kvitteringer genbruges aldrig.
- **Hård tidsgrænse:** 600 s pr. kørsel (≈ 1,5 × run1's maksimum på 385 s). Ved overskridelse afbrydes kørslen, `harness-timeout` logges, og driveren fortsætter.
- **Receipts-placering:** før start verificeres, at `%TEMP%\wsdk-s7-exp1` ikke ligger under AddOns-roden; ellers stop.
- **Stiscanning:** før log eller rapport vises eller gemmes endeligt, afvises den, hvis den indeholder `\Users\`, AddOns-roden eller et AddOn-navn fra profilen.

## Verifikation før rigtige kørsler

1. **Tørløb mod selvforfattet træ:** et midlertidigt AddOn-træ med egne filer (samme mønster som `tests/selected-source-grouped.test.mjs`). Bekræfter logformat, genoptagelse efter afbrydelse og stiscanning.
2. **Tvunget kodeløs fejl:** `analyze` kaster en `Error` uden `code`. Bekræfter at `phase`/`errorName` logges, og at kvitteringen stadig har `code: null`.

Begge skal bestå, før de 21 kørsler mod installationen startes.

## Leverance

En tabel (gruppe → udfald → kode/fejlklasse → median varighed → median RSS → antal lav-belastningskørsler) plus støjbund-status, egnet som kommentar på #11. Den postes kun efter udtrykkeligt ja. Rå log forbliver lokalt.

## Åbne punkter

- Ejerskab af stage 7 er ikke afgjort; andre sessioner kører videre. Konklusioner med mange `uafgjort` vil pege på, at eneejerskab er nødvendigt for en ren måling.
