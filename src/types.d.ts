declare module 'shacl-engine' {
  import type * as RDF from '@rdfjs/types'

  export interface ValidationResult {
    focusNode?: { term: RDF.Term }
    path?: Array<{ quantifier: string; start: string; end: string; predicates: RDF.Term[] }> | null
    severity?: RDF.Term
    shape?: { ptr?: { term?: RDF.Term } }
    constraintComponent?: RDF.Term
    message?: RDF.Literal[]
    value?: { term?: RDF.Term } | null
    results?: ValidationResult[]
    source?: RDF.Term[]
  }

  export interface ValidationReport {
    conforms: boolean
    results: ValidationResult[]
  }

  export class Validator {
    constructor (shapes: RDF.DatasetCore, options: {
      factory: RDF.DataFactory
      details?: boolean
      debug?: boolean
      validations?: unknown
      targetResolvers?: unknown
    })

    validate (data: { dataset: RDF.DatasetCore, terms?: Iterable<RDF.Term> }, shapes?: { terms?: Iterable<RDF.Term> }): Promise<ValidationReport>
  }
}

declare module 'shacl-engine/sparql.js' {
  export const validations: unknown
  export const targetResolvers: unknown
}

declare module '@rdfjs/data-model' {
  import type * as RDF from '@rdfjs/types'
  const factory: RDF.DataFactory
  export default factory
}

declare module '@rdfjs/dataset' {
  import type * as RDF from '@rdfjs/types'
  const factory: { dataset (quads?: Iterable<RDF.Quad>): RDF.DatasetCore }
  export default factory
}
