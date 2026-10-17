import { localName, otherProperties, type NodeShape, type Quad } from '@rdf-data-manager/core'
import { n, t } from './i18n'

/** The triples of a resource that the shape does not manage; they are left alone on save. */
export function OtherProperties ({ quads, iri, shape }: { quads: Quad[]; iri: string; shape: NodeShape }) {
  const other = otherProperties(quads, iri, shape)
  if (other.length === 0) return null
  const rejected = other.filter(o => o.violatesClosed).length
  return (
    <details className='other-properties'>
      <summary>{n(other.length, '1 other property', '{n} other properties')}</summary>
      <p className='muted small'>
        {t('These triples are outside the shape and are left alone when the resource is saved.')}
        {rejected > 0 && <> {n(rejected, 'The shape is closed, so a check reports 1 of them.', 'The shape is closed, so a check reports {n} of them.')}</>}
      </p>
      <table className='data-table'>
        <tbody>
          {other.map((o, i) => (
            <tr key={i} className={o.violatesClosed ? 'violation' : undefined}>
              <th scope='row' title={o.predicate}>{localName(o.predicate)}</th>
              <td>{o.object.termType === 'NamedNode' ? <span className='mono' title={o.object.value}>{localName(o.object.value)}</span> : o.object.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
