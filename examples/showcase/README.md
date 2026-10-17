# Feature tour

A small railway network whose shapes use every editor, viewer, widget and SHACL feature
the app supports. Run it in the browser with `?demo=showcase` (or "Try a demo" in
Settings); add `&lang=nb` for the Norwegian interface. `shapes.ttl` and `data.ttl` can
also be loaded into a real endpoint.

## Where to look

| Feature | Where |
|---|---|
| Language-tagged text, one per language from a fixed list (`rdm:languages`, `sh:uniqueLang`) | Name on every resource |
| Multi-line text with a language picker (`sh:languageIn`, `dash:TextAreaWithLangEditor`) | Description |
| `sh:pattern` with its own `sh:message`, `dash:singleLine` | Station › Station code |
| Enumeration of IRIs and of literals (`sh:in`), `sh:defaultValue` | Station › Category, Status; Line › Gauge |
| Date, boolean, integer and decimal with ranges (`sh:minInclusive`, `sh:maxInclusive`) | Station › Opened, Facilities |
| URI editor and viewer | Station › Web page; Organisation › Web site |
| Property groups (`sh:group`), `sh:order`, `rdm:order` | Every form and the menu |
| Read-only fields, `rdm:defaultValue rdm:today`, `rdm:updateOnSave` | Record › Created, Modified |
| Hidden field (`dash:hidden`) | Station › `ex:internalNote` on Oslo Central, kept in the data |
| Map: point, line, polygon (`geo:hasGeometry` / `geo:asWKT`) | Station, Line, Area › Location |
| Instance picker and search-as-you-type (`dash:InstancesSelectEditor`, `dash:AutoCompleteEditor`) | Station › Replaced by; Line › Stations served |
| Long lists with `rdm:pageSize` and `rdm:orderBy` | Line › Stations served |
| Nested nodes with minted IRIs (`dash:DetailsEditor`, `rdm:localNameProperty`, `rdm:hideFromMenu`) | Line › Sections |
| `sh:xone` of two classes | Line › Operator (Old Voss Line is run by a person) |
| `sh:or` of two classes and of two datatypes | Track closure › Affects, Reported |
| OWL-Time interval, `xsd:time`, `xsd:duration`, `xsd:gYear`, `xsd:gYearMonth` | Track closure › When |
| Instance list sorted by a property, descending | Track closure (`rdm:orderBy`, `rdm:orderDescending`) |
| Closed shape (`sh:closed`, `sh:ignoredProperties`) and "other properties" | Organisation › Vy |
| `rdm:queryText`: run a stored query from the form | Report › Query › Preview query result |
| "Used by": resources that point here | Bottom of a station or organisation |
| Shapes that target by predicate (`sh:targetSubjectsOf`) | Station › Brakerøya |

## Problems on purpose

"Check all data" reports these, so the validation report and the problem markers in the
forms have something to show:

| Resource | Severity | Why |
|---|---|---|
| Station Skøyen | Violation | Station code `Sk` does not match the pattern |
| Organisation Vy | Violation | `ex:legacyId` is not allowed by the closed shape |
| Station Drammen | Warning | No Bokmål name (SPARQL constraint) |
| Station Bryn | Warning | Open but no number of platforms (SPARQL constraint) |
| Station Brakerøya | Warning | Replaced by Drammen but not closed (`sh:targetSubjectsOf`) |

Coordinates, numbers and dates are approximate and only for the demo.
