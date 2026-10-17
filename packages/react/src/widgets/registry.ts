import type { PropertyShape, Term } from '@rdf-data-manager/core'
import type { Widget } from './types'

/** The widgets a form can use, looked up by dash:editor IRI or chosen by score. */
export class WidgetRegistry {
  private readonly widgets = new Map<string, Widget>()

  constructor (widgets: Widget[] = []) {
    this.register(widgets)
  }

  register (widget: Widget | Widget[]): this {
    for (const w of Array.isArray(widget) ? widget : [widget]) this.widgets.set(w.id, w)
    return this
  }

  get (id: string): Widget | undefined {
    return this.widgets.get(id)
  }

  all (): Widget[] {
    return [...this.widgets.values()]
  }

  pickEditor (property: PropertyShape, value?: Term): Widget | undefined {
    return this.pick(property, value, 'Editor', property.editor)
  }

  pickViewer (property: PropertyShape, value?: Term): Widget | undefined {
    return this.pick(property, value, 'Viewer', property.viewer)
  }

  private pick (property: PropertyShape, value: Term | undefined, part: 'Editor' | 'Viewer', explicit?: string): Widget | undefined {
    if (explicit) {
      const named = this.widgets.get(explicit)
      if (named?.[part]) return named
    }
    let best: Widget | undefined
    let bestScore = 0
    for (const w of this.widgets.values()) {
      if (!w[part]) continue
      const s = w.score(property, value)
      if (s > bestScore) {
        best = w
        bestScore = s
      }
    }
    return best
  }
}
