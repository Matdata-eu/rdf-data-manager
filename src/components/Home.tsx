import { useApp } from '../app/context'
import { href } from '../app/router'
import { labelOf, text } from '../shapes/model'

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
