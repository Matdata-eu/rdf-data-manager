import type { PropertyShape } from '../shapes/model'
import { RDF_LANG_STRING } from '../rdf/terms'

const D = 'http://datashapes.org/dash#'
const XSD = 'http://www.w3.org/2001/XMLSchema#'

export const DASH = {
  TextFieldEditor: `${D}TextFieldEditor`,
  TextAreaEditor: `${D}TextAreaEditor`,
  TextFieldWithLangEditor: `${D}TextFieldWithLangEditor`,
  TextAreaWithLangEditor: `${D}TextAreaWithLangEditor`,
  DatePickerEditor: `${D}DatePickerEditor`,
  DateTimePickerEditor: `${D}DateTimePickerEditor`,
  BooleanSelectEditor: `${D}BooleanSelectEditor`,
  EnumSelectEditor: `${D}EnumSelectEditor`,
  InstancesSelectEditor: `${D}InstancesSelectEditor`,
  AutoCompleteEditor: `${D}AutoCompleteEditor`,
  URIEditor: `${D}URIEditor`,
  DetailsEditor: `${D}DetailsEditor`,
  BlankNodeViewer: `${D}BlankNodeViewer`,
  DetailsViewer: `${D}DetailsViewer`,
  LabelViewer: `${D}LabelViewer`,
  LiteralViewer: `${D}LiteralViewer`,
  LangStringViewer: `${D}LangStringViewer`,
  URIViewer: `${D}URIViewer`,
  HTMLViewer: `${D}HTMLViewer`
} as const

export type EditorKind =
  | 'text' | 'textarea' | 'langText' | 'langTextarea' | 'date' | 'dateTime'
  | 'boolean' | 'enum' | 'instances' | 'uri' | 'details'

export type ViewerKind = 'literal' | 'label' | 'uri' | 'details'

/**
 * Picks the editor for a property: dash:editor when present, otherwise the widget
 * DASH would score highest for the property's constraints.
 */
export function editorFor (p: PropertyShape): EditorKind {
  switch (p.editor) {
    case DASH.TextFieldEditor: return 'text'
    case DASH.TextAreaEditor: return 'textarea'
    case DASH.TextFieldWithLangEditor: return p.singleLine === false ? 'langTextarea' : 'langText'
    case DASH.TextAreaWithLangEditor: return 'langTextarea'
    case DASH.DatePickerEditor: return 'date'
    case DASH.DateTimePickerEditor: return 'dateTime'
    case DASH.BooleanSelectEditor: return 'boolean'
    case DASH.EnumSelectEditor: return 'enum'
    case DASH.InstancesSelectEditor:
    case DASH.AutoCompleteEditor: return 'instances'
    case DASH.URIEditor: return 'uri'
    case DASH.DetailsEditor: return 'details'
  }
  if (p.in?.length) return 'enum'
  if (p.datatype === RDF_LANG_STRING || (p.languageIn?.length ?? 0) > 0) return p.singleLine === false ? 'langTextarea' : 'langText'
  if (p.datatype === `${XSD}date`) return 'date'
  if (p.datatype === `${XSD}dateTime`) return 'dateTime'
  if (p.datatype === `${XSD}boolean`) return 'boolean'
  if (p.classes.length > 0) return 'instances'
  if (p.node && p.nodeKind?.endsWith('#BlankNode')) return 'details'
  if (p.nodeKind?.endsWith('#IRI')) return 'uri'
  return p.singleLine === false ? 'textarea' : 'text'
}

export function viewerFor (p: PropertyShape): ViewerKind {
  switch (p.viewer) {
    case DASH.DetailsViewer:
    case DASH.BlankNodeViewer: return 'details'
    case DASH.LabelViewer: return 'label'
    case DASH.URIViewer: return 'uri'
    case DASH.LiteralViewer:
    case DASH.LangStringViewer:
    case DASH.HTMLViewer: return 'literal'
  }
  if (p.node && editorFor(p) === 'details') return 'details'
  if (p.classes.length > 0) return 'label'
  return 'literal'
}

/** True when values of this property are literals (as opposed to IRIs or nodes). */
export function isLiteralEditor (kind: EditorKind): boolean {
  return ['text', 'textarea', 'langText', 'langTextarea', 'date', 'dateTime', 'boolean'].includes(kind)
}

export function isLangEditor (kind: EditorKind): boolean {
  return kind === 'langText' || kind === 'langTextarea'
}
