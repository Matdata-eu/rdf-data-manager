import type { ComponentType } from 'react'
import type { PropertyShape, Term, ValueState } from '@rdf-data-manager/core'

export interface WidgetEditorProps {
  property: PropertyShape
  /**
   * The value being edited: its text, language tag and the RDF term it came from. For a
   * property edited as nested nodes, value.node is the nested node's state; a widget
   * that claims such a property edits that node (see withText / withNode in core).
   */
  value: ValueState
  onChange: (value: ValueState) => void
  /** Id for the input element, so the field label can point at it. */
  id: string
  invalid: boolean
}

export interface WidgetViewerProps {
  property: PropertyShape
  value: ValueState
}

/**
 * A widget edits or shows the values of one property. It is chosen by its id when the
 * property shape names it in dash:editor / dash:viewer, otherwise by the highest score.
 */
export interface Widget {
  /** The dash:editor (or dash:viewer) IRI this widget implements. */
  id: string
  /** How well the widget fits a property; 0 means not at all. DASH uses 1 to 10. */
  score: (property: PropertyShape, value?: Term) => number
  /**
   * For a widget that claims nested nodes: show each node on one line like a literal value,
   * with a remove button beside it, instead of in a nested box with a header.
   */
  inline?: boolean
  Editor?: ComponentType<WidgetEditorProps>
  Viewer?: ComponentType<WidgetViewerProps>
}
