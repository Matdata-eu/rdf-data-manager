# 4. Shapes live in a named graph next to the data by default

Date: 2026-10-16

## Status

Accepted

## Context

The shapes configure the whole app. They need a home that every deployment of the app
against the same data finds, that can be updated without redeploying the app, and that
keeps them out of the data graph.

## Decision

By default the app loads the shapes from a named graph in the same endpoint as the data
(for DIM: `<https://data.banenor.no/data/_shapes_metadata>` in `/metadata`). A Turtle URL
or a local file can be chosen instead in Settings or configuration.

## Consequences

- `tools/load-shapes` puts a shapes file into its graph with the Graph Store Protocol.
- The data graph can stay the default graph; queries never mix shapes and data.
- A deployment without write access to the endpoint uses the URL or file option.
