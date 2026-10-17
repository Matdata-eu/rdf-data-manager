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
  score: p => p.datatype === 'https://example.org/datatypes#colour' ? 10 : 0,
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

In the app without a rebuild: publish the widget as an ES module (a URL the browser can
import) and list it in `config.json`:

```json
{ "widgets": ["https://cdn.example.org/rdm-widget-colour.js"] }
```

The module's default export is a `Widget` or an array of them. A module that fails to
load is reported in the app and the built-in editors are used instead.

A widget that needs a large library (a map) should import it lazily inside the component
(`React.lazy` or a dynamic `import()`), so a form without such a property never loads it.

## Nested nodes

A property whose values are nested nodes (`dash:DetailsEditor` with `sh:node`, for
example a table's columns or a `geo:Geometry` with `geo:asWKT`) is rendered by the form
as a nested `NodeForm`; widgets apply to the nested node's own properties. A widget that
wants to edit a whole nested node at once (a map that owns the geometry node) is the next
step on the roadmap; today a map widget is written for the `geo:asWKT` literal.
