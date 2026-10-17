import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Parser } from 'n3'
import { buildShapesModel, emptyState, firstNode, firstText, managedQuads, namedNode, withLanguageSlots, type PropertyShape } from '@rdf-data-manager/core'
import { FormContext, NodeForm, WidgetRegistry, builtinWidgets, type FormServices } from '@rdf-data-manager/react'
import { timeWidget, DATE_TIME_STAMP, DURATION, HAS_BEGINNING, INTERVAL, OWL_TIME, joinDateTime, parseDuration, splitDateTime, writeDuration, ZONES, offsetMinutes } from '../src'

const EX = 'https://example.org/'
const shapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dash: <http://datashapes.org/dash#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <${EX}> .

ex:EventShape a sh:NodeShape ; sh:targetClass ex:Event ; rdfs:label "Event"@en ;
  sh:property [ sh:path ex:when ; sh:name "When"@en ; sh:class time:Interval ; sh:node ex:IntervalShape ; sh:nodeKind sh:BlankNode ; sh:maxCount 1 ; dash:editor dash:DetailsEditor ] ;
  sh:property [ sh:path ex:took ; sh:name "Took"@en ; sh:datatype xsd:duration ; sh:maxCount 1 ] .

ex:IntervalShape a sh:NodeShape ; sh:targetClass time:Interval ;
  sh:property [ sh:path time:hasBeginning ; sh:name "Beginning"@en ; sh:class time:Instant ; sh:node ex:InstantShape ; sh:nodeKind sh:BlankNode ; sh:maxCount 1 ; dash:editor dash:DetailsEditor ] ;
  sh:property [ sh:path time:hasEnd ; sh:name "End"@en ; sh:class time:Instant ; sh:node ex:InstantShape ; sh:nodeKind sh:BlankNode ; sh:maxCount 1 ; dash:editor dash:DetailsEditor ] .

ex:InstantShape a sh:NodeShape ; sh:targetClass time:Instant ;
  sh:property [ sh:path time:inXSDDateTimeStamp ; sh:datatype xsd:dateTimeStamp ; sh:maxCount 1 ] .
`
const model = buildShapesModel(new Parser().parse(shapes))

function property (over: Partial<PropertyShape>): PropertyShape {
  return {
    id: namedNode('urn:p'),
    key: 'p',
    path: namedNode('urn:path'),
    name: {},
    description: {},
    order: 0,
    classes: [],
    uniqueLang: false,
    readOnly: false,
    hidden: false,
    updateOnSave: false,
    orderDescending: false,
    ...over
  }
}

describe('xsd helpers', () => {
  it('splits and joins dateTimeStamps', () => {
    expect(splitDateTime('2026-03-06T08:00:00+01:00')).toEqual({ local: '2026-03-06T08:00:00', zone: '+01:00' })
    expect(splitDateTime('2026-03-06T08:00Z')).toEqual({ local: '2026-03-06T08:00', zone: 'Z' })
    expect(joinDateTime({ local: '2026-03-06T08:00', zone: 'Z' })).toBe('2026-03-06T08:00:00Z')
    expect(splitDateTime('not a date')).toEqual({ local: '', zone: '' })
  })

  it('round-trips durations', () => {
    for (const d of ['P1Y2M3DT4H5M6S', 'PT30M', 'P7D', '-P1M', 'PT0.5S']) expect(writeDuration(parseDuration(d))).toBe(d)
    expect(writeDuration(parseDuration(''))).toBe('')
  })

  it('orders the zones by offset', () => {
    const offsets = ZONES.map(offsetMinutes)
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
    expect(ZONES[0]).toBe('-12:00')
  })
})

describe('time widget', () => {
  it('claims the time datatypes and OWL-Time nodes', () => {
    expect(timeWidget.score(property({ datatype: DATE_TIME_STAMP }))).toBe(20)
    expect(timeWidget.score(property({ datatype: DURATION }))).toBe(20)
    expect(timeWidget.score(property({ node: 'urn:s', classes: [INTERVAL] }))).toBe(20)
    expect(timeWidget.score(property({ path: namedNode(HAS_BEGINNING), node: 'urn:s' }))).toBe(20)
    expect(timeWidget.score(property({ datatype: 'http://www.w3.org/2001/XMLSchema#date' }))).toBe(0)
    expect(timeWidget.score(property({ node: 'urn:s', classes: [`${EX}Other`] }))).toBe(0)
  })

  it('edits an interval through nested instants and a duration as fields', () => {
    const shape = model.shapeForClass(`${EX}Event`)!
    let state = withLanguageSlots(emptyState(shape, model, `${EX}Event`))
    const registry = new WidgetRegistry([...builtinWidgets, timeWidget])
    const svc: FormServices = { repo: {} as never, model, languages: ['en'], revision: 0, registry }
    const onChange = (n: typeof state) => { state = n; view.rerender(ui()) }
    const ui = () => <FormContext.Provider value={svc}><NodeForm node={state} onChange={onChange} issues={[]} subjects={new Map()} /></FormContext.Provider>
    const view = render(ui())

    fireEvent.click(screen.getByRole('button', { name: /Add when/i }))
    expect(screen.getByRole('group', { name: 'Interval' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Set from' }))
    const dt = screen.getByDisplayValue('') as HTMLInputElement
    expect(dt.type).toBe('datetime-local')
    fireEvent.change(dt, { target: { value: '2026-03-06T08:00' } })
    const when = firstNode(state, `${EX}when`)!
    const beginning = firstNode(when, HAS_BEGINNING)!
    expect(firstText(beginning, `${OWL_TIME}inXSDDateTimeStamp`)).toMatch(/^2026-03-06T08:00:00(Z|[+-]\d{2}:\d{2})$/)

    fireEvent.click(screen.getByRole('button', { name: '+ Add value' }))
    fireEvent.change(screen.getByRole('group', { name: 'Duration' }).querySelectorAll('input')[3], { target: { value: '2' } })
    expect(firstText(state, `${EX}took`)).toBe('PT2H')
    const quads = managedQuads({ ...state, subject: namedNode(`${EX}e1`) })
    expect(quads.some(q => q.predicate.value === `${EX}took` && q.object.value === 'PT2H')).toBe(true)
  })
})
