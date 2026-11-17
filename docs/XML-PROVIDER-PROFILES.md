# Hvad betyder en XML-profil?

En profil er en lille konfiguration til SDK-analysen. Den fortæller, hvilke XML-elementer analysen skal genkende. Den ændrer ingen WoW-indstillinger og eksekverer ingen AddOn-kode.

| Konstruktion | Hvad analysen registrerer |
| --- | --- |
| `<Ui>` | Dokumentets genkendte rod |
| `<Frame name="MinRamme">` | En mulig ramme/global med ukendt aktivering |
| `<Include file="Anden.xml">` | En filreference, som bevares uden at åbne filen |
| `<Script file="Kode.lua">` | En reference til en Lua-fil |
| `<Script>…</Script>` | Inline-tekst med præcise positioner i den oprindelige XML |
| `<Frame><Scripts><OnLoad>…</OnLoad></Scripts></Frame>` | En handler-tekst med præcise positioner |

Navnerum indgår også i genkendelsen. To elementer med samme navn kan tilhøre forskellige XML-vokabularer. Profilen bruger derfor både det lokale navn og navnerummets identitet. Et valgt præfiks er ikke i sig selv elementets identitet.

Du behøver ikke skrive JSON selv. Før en lokal providerkørsel kan vi forberede et konkret udkast, forklare hvilke konstruktioner det dækker, og vælge det udtrykkeligt. En profil er en analyseantagelse; den beviser ikke, hvad spillets loader gør.

Vi har allerede den tidligere valgte lokale AddOns-sti. De nødvendige tekstfiler kan senere undersøges skrivebeskyttet for at forberede profilen ud fra observerede elementer/navnerum. Det er SDK-arbejde; brugeren behøver ikke vælge tekniske JSON-felter. Observation af et navn eller en struktur beviser ikke i sig selv loaderens adfærd.

[Eksempelprofilen](../examples/xml-provider-profile.json) er selvskrevet til syntetiske eksempler med de seks konstruktioner ovenfor og **uden XML-navnerum** (`namespaceUri:null`). Den genkender kun Frame og OnLoad i denne lille vokabular. Den er ikke valgt til den installerede AddOns-mappe og er ikke en komplet Classic Era-profil. Elementer uden for den valgte vokabular bliver ikke automatisk widgets eller scripts; en ukendt rod giver XUI0004 og incomplete.

Den oprindelige brugerbeslutning, 2026-11-17, var at gennemføre syntetiske provider-tests og CI, mens den lokale profil blev forberedt. Efter brugerens præcisering har assistenten forberedt og udtrykkeligt valgt en lokal analyseprofil og gennemført [den faktiske providerkørsel på 580ed8b](https://github.com/Zilvereyes/wow-addon-sdk/issues/11#issuecomment-6951837363). Den validerer 1.146 projektioner: 1.116 komplette under profilen og 30 ufuldstændige rødder; 53 syntaksafvisninger får ingen providerprojektion. Alle 1.199 XML-hashkontroller matcher. Resultatet er stadig exit1/fullParsing=false, og udækkede handler-, animations-, font- og bindingsdomæner er ikke fuld spildækning. De tidligere TOC/Lua/XML-syntaksresultater beholder deres oprindelige implementeringscommit.

Kørslen på 580ed8b udtrak 37 chunks og 1.302 handlers, men parsede ingen af dem som Lua. Brugeren har siden godkendt [inline Lua A–E](PROPOSAL-INLINE-LUA.md), som er implementeret til review i PR #29. En separat kontekstprofil angiver eksplicitte lokale parametre og varargs for de valgte handlers; en XML-vokabularprofil fastlægger ikke handlerens Lua-signatur. [Migrationen](MIGRATION-v0.6-to-v0.7.md) indeholder et selvskrevet eksempel. Den faktiske installerede inline-kørsel afventer et konkret forberedt og valgt kontekstgrundlag. Brugeren skal fortsat ikke skrive JSON.

Det selvskrevne eksempel kan køres uden spilinstallationen:

```powershell
node scripts/inspect-addon-corpus.mjs examples/xml-provider --xml-analysis --xml-provider-profile examples/xml-provider-profile.json
```

Eksemplet registrerer en ukendt frame-kandidat, en uåbnet filreference og to inline-tekster. `NotTraversed.xml` findes bevidst ikke: denne analyse følger ingen referencer. Resultatet siger derfor stadig fullParsing=false. Ingen af teksterne eksekveres eller tælles som Lua-parsing.

Teknisk er formatet `{ "schemaVersion": 1, "policy": { ... } }`. Den [godkendte kontrakt](PROPOSAL-XML-PROVIDER.md) beskriver præcis matchning, grænser og fejl. [Migrationen](MIGRATION-v0.5-to-v0.6.md) viser API-brug.
