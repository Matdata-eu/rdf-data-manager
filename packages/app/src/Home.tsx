import { labelOf, text } from '@rdf-data-manager/core'
import { useApp } from './context'
import { href } from './router'

export function Home () {
  const { model, languages } = useApp()
  return (
    <section>
      <h1>Overview</h1>
      <div className='cards'>
        {model.classes.map(c => (
          <a key={c.iri} className='card link' href={href({ name: 'class', classIri: c.iri })}>
            <h2>{labelOf(c.label, c.iri, languages)}</h2>
            <p className='muted'>{text(c.comment, languages)}</p>
          </a>
        ))}
      </div>
    </section>
  )
}
