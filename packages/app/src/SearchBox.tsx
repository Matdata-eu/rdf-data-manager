import { useState, type FormEvent } from 'react'
import { navigate } from './router'

/** The search box in the top bar; submitting goes to the results page. */
export function SearchBox ({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate({ name: 'search', query: query.trim() })
  }
  return (
    <form className='search-box' role='search' onSubmit={submit}>
      <input type='search' aria-label='Search' placeholder='Search…' value={query} onChange={e => setQuery(e.target.value)} />
    </form>
  )
}
