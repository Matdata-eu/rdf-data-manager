# Widgets

A widget edits or shows the values of one property. The built-in text, language, date,
boolean, enum, instance and IRI editors are widgets; a map for `geo:hasGeometry` or a
calendar for `time:` properties is written the same way.

## The interface

```typescript
import type { Widget } from '@rdf-data-manager/react'

export interface Widget {
  /** The dash:editor (or dash:viewer) IRI this widget implements. */
  id: string
  /** How well the widget fits a property; 0 means not at all. DASH uses 1 to 10. */
  score: (property: PropertyShape, value?: Term) => number
  Editor?: ComponentType<WidgetEditorProps>
  Viewer?: ComponentType<WidgetViewerProps>
}

export interface WidgetEditorProps {
  property: PropertyShape
  value: ValueState            // { id, text, lang?, term? }
  onChange: (value: ValueState) => void
  id: string                   // for the input element, so the label points at it
  invalid: boolean
}
```

The registry picks a widget in two steps: when the property shape names an editor with
`dash:editor` (or a viewer with `dash:viewer`) and a widget with that id is registered,
that widget is used; otherwise every registered widget is scored and the highest score
wins. The built-in widgets score 10 for the properties DASH's own rules give them, so a
custom widget takes over by scoring higher, or by being named in the shapes, or by being
registered under a built-in widget's own IRI.

`value.text` is the lexical form being edited; `value.term` is the RDF term it was loaded
from or chosen as. The form turns the value into a term on save using the property's
constraints (datatype, language, node kind), so a widget only has to keep `text` (and
`lang` or `term`) right. Services such as the repository, the shapes model and the
preferred languages come from `useForm()`.

## A minimal widget

```tsx
import type { Widget } from '@rdf-data-manager/react'

const colour: Widget = {
  id: 'https://example.org/widgets#ColourEditor',
  score: p => p.datatype === 'https://example.org/datatypes#colour' ? 20 : 0,
  Editor: ({ value, onChange, id, invalid }) => (
    <input id={id} type='color' aria-invalid={invalid} value={value.text || '#000000'}
      onChange={e => onChange({ ...value, text: e.target.value })} />
  )
}

export default colour
```

## Using a widget

In another React app:

```tsx
import { FormContext, NodeForm, WidgetRegistry, builtinWidgets } from '@rdf-data-manager/react'
import colour from './colour'

const registry = new WidgetRegistry([...builtinWidgets, colour])
// <FormContext.Provider value={{ repo, model, languages, revision, registry }}><NodeForm … /></FormContext.Provider>
```

In the app, `config.json` lists the widgets to load (`RDM_WIDGETS=map,time` for the
container image). The map and time widgets ship with the app as separate chunks that are
only downloaded when listed:

```json
{ "widgets": ["map", "time"] }
```

Any other entry is the URL of an ES module the browser can import, so a deployment adds a
widget without a rebuild:

```json
{ "widgets": ["map", "https://cdn.example.org/rdm-widget-colour.js"] }
```

The module's default export is a `Widget` or an array of them. A module that fails to
load is reported in the app and the built-in editors are used instead.

## The bundled widgets

| Widget | Package | Claims |
|---|---|---|
| `map` | [`@rdf-data-manager/widget-map`](../packages/widget-map) | `geo:wktLiteral` / `geo:asWKT` literals and nested `geo:Geometry` nodes (`geo:hasGeometry`). A click places a point; the Line and Polygon tools draw a linestring or polygon vertex by vertex (Finish, Undo point, Cancel), replacing the current geometry; every vertex of the shown geometry can be dragged. Multi-geometries are shown and their vertices dragged, and anything else can be edited as WKT text. CRS84 and EPSG:4326 are shown; other CRSs stay editable as text. Tiles come from OpenStreetMap by default (`configureMap` changes the tile URL). |
| `time` | [`@rdf-data-manager/widget-time`](../packages/widget-time) | `xsd:dateTimeStamp`, `xsd:time`, `xsd:gYear`, `xsd:gYearMonth` and `xsd:duration` literals, and OWL-Time nodes: a `time:Instant` becomes one field, a `time:Interval` a from/to pair, each built from the nested shape (`time:hasBeginning` / `time:hasEnd`, `time:inXSDDateTimeStamp` and friends). |

Both are named in shapes as `dash:editor rdm:MapEditor` / `rdm:TimeEditor`, and otherwise
win by score. [examples/geo-time](../examples/geo-time) has shapes and data to try them;
[examples/showcase](../examples/showcase) also draws lines and polygons and uses every time datatype.

A widget that needs a large library (a map) should import it lazily inside the component
(`React.lazy` or a dynamic `import()`), so a form without such a property never loads it.

## Scoped tags

`rdm:ScopedTagEditor` and `rdm:ScopedTagViewer` are built in. They show a nested node as
one identifier in a scope, "register | entry": a two-part tag with the scope on a sunken
plate, one per line with a remove button, instead of a nested box. The first two
properties of the nested shape, in `sh:order`, are the scope and the entry. They are used
only when the shapes name them:

```turtle
ex:designators a sh:PropertyShape ;
    sh:path railml3:hasDesignator ;
    sh:class railml3:Designator ;
    sh:node ex:DesignatorShape ;          # railml3:hasRegister (order 1), railml3:hasEntry (order 2)
    sh:nodeKind sh:BlankNode ;
    dash:editor rdm:ScopedTagEditor ;
    dash:viewer rdm:ScopedTagViewer .
```

A widget of your own does the same by setting `inline: true`. The feature tour
([examples/showcase](../examples/showcase)) uses it for railML designators
(register | entry) and type designators (rulebook | entry) on stations and switches.

## Nested nodes

A property whose values are nested nodes (`dash:DetailsEditor` with `sh:node`, for
example a table's columns or a `geo:Geometry` with `geo:asWKT`) is rendered by the form
as a nested `NodeForm`, and widgets apply to the nested node's own properties. A widget's
own `dash:editor` (one outside DASH) on a property with `sh:node` also makes it nested. A widget
can also claim the whole nested node: when its `score` is positive for such a property,
its `Editor` receives a value whose `node` is the nested `NodeState`, and edits it with
the helpers from core (`firstText`, `withText`, `firstNode`, `withNode`). The map widget
does this for `geo:Geometry` nodes and the time widget for `time:Interval` and
`time:Instant` nodes; see their `index.tsx` for the pattern. Saving is unchanged: the
form turns the nested node into triples with blank or minted subjects as the shape says.
