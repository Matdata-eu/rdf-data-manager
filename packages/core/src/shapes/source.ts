import { Store } from 'n3'
import { RDF_TYPE, XSD_STRING, literal, ns, toNT, type Literal, type Quad, type Term } from '../rdf/terms'
import { declaredPrefixes } from '../data/export'
import type { ShapesModel } from './model'

/** Named-shape references followed to collect every shape behind a class's form. */
const SHAPE_REFS = new Set(['property', 'node', 'qualifiedValueShape', 'not', 'and', 'or', 'xone'].map(p => ns.sh(p).value))

const XSD = ns.xsd('').value
const FIRST = ns.rdf('first').value
const REST = ns.rdf('rest').value
const NIL = ns.rdf('nil').value
const INDENT = '    '
/** rdf:type, then sh:path, lead a block; the rest keep the order the shapes graph has them. */
const LEADING = [RDF_TYPE.value, ns.sh('path').value]

function rank (predicate: string): number {
  const i = LEADING.indexOf(predicate)
  return i < 0 ? LEADING.length : i
}

function named (iri: string): Term {
  return { termType: 'NamedNode', value: iri } as Term
}

function triples (store: Store, subject: Term): Quad[] {
  return store.getQuads(subject as never, null, null, null) as Quad[]
}

/** The objects of a subject's triples, with blank nodes and RDF lists followed. */
function reachable (store: Store, subject: Term, seen = new Set<string>()): Term[] {
  seen.add(subject.value)
  const out: Term[] = []
  for (const q of triples(store, subject)) {
    if (q.object.termType !== 'BlankNode') out.push(q.object)
    else if (!seen.has(q.object.value)) out.push(...reachable(store, q.object, seen))
  }
  return out
}

/**
 * The named shapes behind a class's form: the node shapes targeting the class, then every
 * named shape they reach through sh:property, sh:node and the logical constraints.
 */
export function shapeIdsForClass (model: ShapesModel, classIri: string): string[] {
  const store = new Store(model.quads)
  const queue = [...model.nodeShapes.values()].filter(s => s.targetClasses.includes(classIri)).map(s => s.id)
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const q of triples(store, named(id))) {
      if (!SHAPE_REFS.has(q.predicate.value)) continue
      const refs = q.object.termType === 'BlankNode' ? reachable(store, q.object) : [q.object]
      for (const r of refs) if (r.termType === 'NamedNode' && r.value !== NIL && store.countQuads(r as never, null, null, null) > 0) queue.push(r.value)
    }
  }
  return [...seen]
}

/**
 * The shapes behind a class's form as readable Turtle: each named shape with its triples,
 * blank nodes written inline as [ … ] and RDF lists as ( … ). Empty when no shape targets it.
 */
export function shapeSource (model: ShapesModel, classIri: string): string {
  const store = new Store(model.quads)
  const prefixes = Object.entries({
    sh: ns.sh('').value, dash: ns.dash('').value, rdm: ns.rdm('').value, owl: ns.owl('').value, ...declaredPrefixes(model)
  }).sort((a, b) => b[1].length - a[1].length)
  const used = new Set<string>()

  const iri = (value: string): string => {
    for (const [prefix, namespace] of prefixes) {
      if (!value.startsWith(namespace)) continue
      const local = value.slice(namespace.length)
      if (/^[A-Za-z0-9_]([\w.-]*[\w-])?$/.test(local) || local === '') {
        used.add(prefix)
        return `${prefix}:${local}`
      }
    }
    return `<${value}>`
  }

  const literalText = (l: Literal): string => {
    const dt = l.datatype?.value
    if (!l.language && dt === `${XSD}integer` && /^[+-]?\d+$/.test(l.value)) return l.value
    if (!l.language && dt === `${XSD}decimal` && /^[+-]?\d*\.\d+$/.test(l.value)) return l.value
    if (!l.language && dt === `${XSD}boolean` && /^(true|false)$/.test(l.value)) return l.value
    // Multi-line texts such as sh:select stay readable in a long string.
    const lexical = l.value.includes('\n') && !/"""|"$|\\/.test(l.value) ? `"""${l.value}"""` : toNT(literal(l.value))
    if (l.language) return `${lexical}@${l.language}`
    if (dt && dt !== XSD_STRING) return `${lexical}^^${iri(dt)}`
    return lexical
  }

  const list = (head: Term): Term[] | undefined => {
    const items: Term[] = []
    let node = head
    while (node.value !== NIL) {
      if (node.termType !== 'BlankNode' || items.length > 10000) return undefined
      const ts = triples(store, node)
      const first = ts.filter(q => q.predicate.value === FIRST)
      const rest = ts.filter(q => q.predicate.value === REST)
      if (ts.length !== 2 || first.length !== 1 || rest.length !== 1) return undefined
      items.push(first[0].object)
      node = rest[0].object
    }
    return items
  }

  // The path guards against blank-node cycles, which are written as _:labels instead.
  const object = (term: Term, depth: number, path: Set<string>): string => {
    if (term.termType === 'NamedNode') return iri(term.value)
    if (term.termType === 'Literal') return literalText(term as Literal)
    if (term.termType !== 'BlankNode' || path.has(term.value)) return toNT(term)
    const inner = new Set(path).add(term.value)
    const items = list(term)
    if (items) return `( ${items.map(i => object(i, depth, inner)).join(' ')} )`
    const ts = triples(store, term)
    if (!ts.length) return '[]'
    return `[\n${body(ts, depth + 1, inner)}\n${INDENT.repeat(depth)}]`
  }

  const body = (ts: Quad[], depth: number, path: Set<string>): string => {
    const byPredicate = new Map<string, Term[]>()
    for (const q of ts) {
      if (!byPredicate.has(q.predicate.value)) byPredicate.set(q.predicate.value, [])
      byPredicate.get(q.predicate.value)!.push(q.object)
    }
    const preds = [...byPredicate.keys()].sort((a, b) => rank(a) - rank(b))
    return preds.map(p => {
      const objects = byPredicate.get(p)!.map(o => object(o, depth, path))
      return `${INDENT.repeat(depth)}${p === RDF_TYPE.value ? 'a' : iri(p)} ${objects.join(', ')}`
    }).join(' ;\n')
  }

  const blocks = shapeIdsForClass(model, classIri).map(id => `${iri(id)}\n${body(triples(store, named(id)), 1, new Set())} .`)
  if (!blocks.length) return ''
  const header = prefixes.filter(([p]) => used.has(p)).sort((a, b) => a[0].localeCompare(b[0])).map(([p, n]) => `@prefix ${p}: <${n}> .`)
  return `${header.join('\n')}\n\n${blocks.join('\n\n')}\n`
}
