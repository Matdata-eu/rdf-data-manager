import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Parser, Store } from 'n3'
import {
  Repository, buildShapesModel, diffQuads, emptyState, managedQuads, namedNode, stateFromQuads, withLanguageSlots,
  type NodeState, type Quad
} from '@rdf-data-manager/core'
import { FormContext, NodeForm, WidgetRegistry, builtinWidgets, type FormServices, type Widget } from '../src'

const BND = 'https://data.banenor.no/data/'
const BNO = 'https://data.banenor.no/ontology/'
const DCT = 'http://purl.org/dc/terms/'

// jsdom replaces the global URL, so paths are built with node:path instead of new URL().
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../shapes-dim')

function readTurtle (path: string): Quad[] {
  return new Parser().parse(readFileSync(join(fixtures, path), 'utf8'))
}

const model = buildShapesModel(readTurtle('shapes/dim-metadata.shapes.ttl'))
const sample = new Store(readTurtle('examples/dim-metadata.sample.ttl'))
const repo = new Repository({ queryUrl: 'http://example.org/query', updateUrl: 'http://example.org/update', dataGraph: '', shapes: { source: 'endpoint', graph: '' } })

function services (registry = new WidgetRegistry(builtinWidgets)): FormServices {
  return { repo, model, languages: ['en'], revision: 0, registry }
}

/** Renders a form around a state and keeps the latest state the form reported. */
function renderForm (initial: NodeState, svc = services()) {
  let current = initial
  const view = render(
    <FormContext.Provider value={svc}>
      <NodeForm node={current} onChange={n => { current = n; view.rerender(<FormContext.Provider value={svc}><NodeForm node={n} onChange={on} issues={[]} subjects={new Map()} /></FormContext.Provider>) }} issues={[]} subjects={new Map()} />
    </FormContext.Provider>
  )
  function on (n: NodeState) { current = n; view.rerender(<FormContext.Provider value={svc}><NodeForm node={n} onChange={on} issues={[]} subjects={new Map()} /></FormContext.Provider>) }
  return { view, state: () => current }
}

describe('NodeForm', () => {
  it('renders a field per property with one input per language', () => {
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const state = withLanguageSlots(stateFromQuads(namedNode(`${BND}_keyFigure_trackLength`), shape, sample, model))
    renderForm(state)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Total track length')).toBeInTheDocument()
    expect(screen.getAllByText('en').length).toBeGreaterThan(0)
  })

  it('reports an edited value as a change to the managed triples', () => {
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const state = withLanguageSlots(stateFromQuads(namedNode(`${BND}_keyFigure_trackLength`), shape, sample, model))
    const form = renderForm(state)
    const input = screen.getByDisplayValue('Total track length')
    fireEvent.change(input, { target: { value: 'Track length in total' } })
    const diff = diffQuads(managedQuads(state), managedQuads(form.state()))
    expect(diff.deletes.map(q => q.object.value)).toEqual(['Total track length'])
    expect(diff.inserts.map(q => q.object.value)).toEqual(['Track length in total'])
    expect(diff.inserts[0].predicate.value).toBe(`${DCT}title`)
  })

  it('picks a widget by score, by dash:editor, and lets a registered widget replace a built-in one', () => {
    const shape = model.shapeForClass(`${BNO}KeyFigure`)!
    const state = withLanguageSlots(emptyState(shape, model, `${BNO}KeyFigure`))
    const titleShape = shape.properties.find(p => p.path.value === `${DCT}title`)!
    const LANG_EDITOR = 'http://datashapes.org/dash#TextFieldWithLangEditor'
    const Shout: Widget['Editor'] = ({ value, onChange, id }) => <input id={id} data-testid='shout' value={value.text} onChange={e => onChange({ ...value, text: e.target.value.toUpperCase() })} />
    const scored: Widget = { id: 'https://example.org/widget#Shout', score: p => p.path.value === `${DCT}title` ? 20 : 0, Editor: Shout }
    const registry = new WidgetRegistry([...builtinWidgets, scored])
    // the DIM shapes name dash:TextFieldWithLangEditor for titles, so that built-in wins by name
    expect(registry.pickEditor(titleShape)?.id).toBe(LANG_EDITOR)
    // without the explicit editor the highest score wins
    expect(registry.pickEditor({ ...titleShape, editor: undefined })?.id).toBe(scored.id)
    // a widget registered under the built-in's own IRI replaces it
    registry.register({ id: LANG_EDITOR, score: () => 0, Editor: Shout })
    renderForm(state, services(registry))
    expect(screen.getAllByTestId('shout').length).toBe(3)
  })

  it('shows problems inside a node that a widget edits as a whole on that widget\'s field', () => {
    const geo = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/geo-time')
    const parse = (f: string) => new Parser().parse(readFileSync(join(geo, f), 'utf8'))
    const geoModel = buildShapesModel(parse('shapes.ttl'))
    const data = new Store(parse('data.ttl'))
    const EX = 'https://example.org/geo-time/'
    const TIME = 'http://www.w3.org/2006/time#'
    const shape = geoModel.shapeForClass(`${EX}Event`)!
    const state = stateFromQuads(namedNode(`${EX}event/maintenance-window`), shape, data, geoModel)
    const interval = state.values[`${TIME}hasTime`][0].node!
    const beginning = interval.values[`${TIME}hasBeginning`][0].node!
    const Calendar: Widget['Editor'] = () => <div data-testid='calendar' />
    const registry = new WidgetRegistry([...builtinWidgets, { id: 'https://example.org/widget#Calendar', score: p => p.path.value === `${TIME}hasTime` ? 20 : 0, Editor: Calendar }])
    const issue = { focusNode: beginning.subject!.value, path: `${TIME}inXSDDateTimeStamp`, severity: 'Violation' as const, message: 'A value is required.' }
    render(
      <FormContext.Provider value={{ repo, model: geoModel, languages: ['en'], revision: 0, registry }}>
        <NodeForm node={state} onChange={() => {}} issues={[issue]} subjects={new Map()} />
      </FormContext.Provider>
    )
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
    expect(screen.getByText('Beginning › At: A value is required.')).toBeInTheDocument()
  })
})

describe('scoped tag widget', () => {
  const RAILML = 'http://ontology.railml.org/railml3#'
  const SW = 'https://example.org/showcase/switch/'
  const showcase = (file: string) => new Parser().parse(readFileSync(join(fixtures, '../../examples/showcase', file), 'utf8'))
  const showcaseModel = buildShapesModel(showcase('shapes.ttl'))
  const showcaseData = new Store(showcase('data.ttl'))
  const svc = (): FormServices => ({ ...services(), model: showcaseModel })

  it('edits a railML designator as register | entry on one line', () => {
    const shape = showcaseModel.shapeForClass('https://example.org/showcase/Switch')!
    const state = stateFromQuads(namedNode(`${SW}lls-101`), shape, showcaseData, showcaseModel)
    const form = renderForm(state, svc())
    expect(screen.getAllByRole('group', { name: 'Designators' })).toHaveLength(2)
    expect(screen.getByDisplayValue('Interlocking')).toHaveAttribute('aria-label', 'Register')
    expect(screen.getByDisplayValue('EN 13232')).toHaveAttribute('aria-label', 'Rule book')
    fireEvent.change(screen.getByDisplayValue('V101'), { target: { value: 'V102' } })
    const diff = diffQuads(managedQuads(state), managedQuads(form.state()))
    // A blank node is rewritten as a whole, so the designator's three triples are replaced.
    const entries = (quads: Quad[]) => quads.filter(q => q.predicate.value === `${RAILML}hasEntry`).map(q => q.object.value)
    expect(entries(diff.deletes)).toEqual(['V101'])
    expect(entries(diff.inserts)).toEqual(['V102'])
  })

  it('shows a read-only designator as a tag', () => {
    const shape = showcaseModel.shapeForClass('https://example.org/showcase/Switch')!
    const state = stateFromQuads(namedNode(`${SW}osl-202`), shape, showcaseData, showcaseModel, 1, true)
    const { container } = renderForm(state, svc()).view
    const tags = [...container.querySelectorAll('.scoped-tag')].map(t => [...t.children].map(c => c.textContent))
    expect(tags).toEqual(expect.arrayContaining([['Interlocking', 'V202'], ['EN 13232', '54E3-300-1:9']]))
    expect(container.querySelector('.scoped-tag input')).toBeNull()
  })
})
