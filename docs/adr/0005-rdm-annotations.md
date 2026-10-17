# 5. App behaviour that DASH cannot express uses the `rdm:` vocabulary

Date: 2026-10-16

## Status

Accepted

## Context

SHACL and DASH cover constraints, editors, viewers and ordering, but not menu order,
IRI minting rules, values set on save, which languages a text field offers, or how many
values to show before collapsing a field.

## Decision

Those are annotations in `https://matdata.eu/ns/rdf-data-manager#` (`rdm:`), on node and
property shapes, documented in the README. Standard SHACL and DASH terms are used wherever
they fit; `rdm:` terms are added only when nothing standard exists.

## Consequences

- A shapes graph stays valid SHACL and works, without the app's extras, in any validator.
- The vocabulary should be published at its namespace IRI once it stabilises.
