import rdfDataModel from '@rdfjs/data-model'
import rdfDataset from '@rdfjs/dataset'
import { Validator, type ValidationResult } from 'shacl-engine'
import { targetResolvers, validations } from 'shacl-engine/sparql.js'
import type { Quad, Term } from '../rdf/terms'

export type Severity = 'Violation' | 'Warning' | 'Info'

export interface Issue {
  focusNode: string
  /** Predicate IRI when the result concerns a single-predicate path. */
  path?: string
  severity: Severity
  /** Shape that produced the result (the property shape for property constraints). */
  sourceShape?: string
  /** The sh:sparql constraint node, for SPARQL-based constraints. */
  sourceConstraint?: string
  constraint?: string
  message: string
  value?: string
}

export interface Report {
  conforms: boolean
  issues: Issue[]
}

function severityOf (term?: Term): Severity {
  const local = term?.value.split('#').pop()
  return local === 'Warning' || local === 'Info' ? local : 'Violation'
}

/** Messages from SPARQL constraints embed values in N-Triples syntax; show them plainly. */
function readable (message: string): string {
  return message
    .replace(/"((?:[^"\\]|\\.)*)"(?:\^\^<[^>]+>|@[A-Za-z-]+)?/g, '$1')
    .replace(/^Less than 1 values$/, 'A value is required.')
    .replace(/^Less than (\d+) values$/, 'At least $1 values are required.')
    .replace(/^More than 1 values$/, 'Only one value is allowed.')
    .replace(/^More than (\d+) values$/, 'At most $1 values are allowed.')
}

function flatten (results: ValidationResult[], out: Issue[] = []): Issue[] {
  for (const r of results) {
    const path = r.path?.length === 1 && r.path[0].predicates.length === 1 ? r.path[0].predicates[0].value : undefined
    const constraint = r.constraintComponent?.value.split('#').pop()
    // "Value does not have shape X" only wraps the nested results; report those instead.
    if (constraint === 'NodeConstraintComponent' && r.results?.length) {
      flatten(r.results, out)
      continue
    }
    out.push({
      focusNode: r.focusNode?.term.value ?? '',
      path,
      severity: severityOf(r.severity),
      sourceShape: r.shape?.ptr?.term?.value,
      sourceConstraint: r.source?.[0]?.value,
      constraint,
      message: readable((r.message ?? []).map(m => m.value).join(' ')) || constraint || 'Constraint violated',
      value: r.value?.term?.value
    })
    if (r.results?.length) flatten(r.results, out)
  }
  return out
}

/** SHACL validator for one shapes graph, supporting SHACL Core and SHACL-SPARQL. */
export class ShapesValidator {
  private readonly validator: Validator

  constructor (shapeQuads: Quad[]) {
    this.validator = new Validator(rdfDataset.dataset(shapeQuads), {
      factory: rdfDataModel,
      details: true,
      validations,
      targetResolvers
    })
  }

  /**
   * Validates data. Nested results (from sh:node and friends) are flattened into the
   * issue list, so a problem on a nested node is reported on that node.
   */
  async validate (dataQuads: Quad[]): Promise<Report> {
    const report = await this.validator.validate({ dataset: rdfDataset.dataset(dataQuads) })
    // A node reached both by a target and through sh:node is checked twice; report each problem once.
    const seen = new Set<string>()
    const issues = flatten(report.results).filter(i => {
      const key = JSON.stringify([i.focusNode, i.path, i.severity, i.sourceShape, i.constraint, i.message, i.value])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return {
      conforms: !issues.some(i => i.severity === 'Violation'),
      issues
    }
  }
}
