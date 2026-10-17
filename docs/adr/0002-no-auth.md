# 2. Authentication and authorisation are out of scope

Date: 2026-10-16

## Status

Accepted

## Context

Bane NOR and other adopters put services behind their own identity layer (an
authenticating proxy, an API gateway). Building accounts into a browser-only app would
duplicate that and store secrets where they do not belong.

## Decision

The app has no notion of users. It sends requests with the browser's credentials
(cookies, or headers a hosting proxy adds) and shows whatever error the endpoint returns.

## Consequences

- Deployments that need access control put the app and the endpoint behind the same
  proxy.
- Features that need an identity (a change log with authors) take the user name from a
  header or configuration, never from a login screen.
