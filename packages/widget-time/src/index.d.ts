import { type Widget } from '@rdf-data-manager/react'
import './time.css'
export * from './xsd'
export { LiteralEditor } from './editors'
export declare const OWL_TIME = 'http://www.w3.org/2006/time#'
export declare const INSTANT = 'http://www.w3.org/2006/time#Instant'
export declare const INTERVAL = 'http://www.w3.org/2006/time#Interval'
export declare const PROPER_INTERVAL = 'http://www.w3.org/2006/time#ProperInterval'
export declare const HAS_BEGINNING = 'http://www.w3.org/2006/time#hasBeginning'
export declare const HAS_END = 'http://www.w3.org/2006/time#hasEnd'
export declare const HAS_TIME = 'http://www.w3.org/2006/time#hasTime'
export declare const TIME_EDITOR = 'https://matdata.eu/ns/rdf-data-manager#TimeEditor'
/** Calendar and clock editors for OWL-Time nodes and the XSD date/time datatypes, as dash:editor rdm:TimeEditor or by score. */
export declare const timeWidget: Widget
export default timeWidget
// # sourceMappingURL=index.d.ts.map
