# ADR-0006: Verified OpenRouter popular models

## Status

Accepted for Stoix 0.1.x.

## Context

Stoix enriches Hermes-advertised OpenRouter models with metadata from OpenRouter's
public model catalog, but must not expose catalog-only models as selectable
Hermes models. That protects the Hermes-configured model list and prevents an
unverified UI hint from silently routing a request through the wrong provider.

Hermes' current HTTP capability contract exposes model listing and session-scoped
model selection, but not a portable configuration-write endpoint. The available
`admin_config_rw` capability is false, and session selection is intentionally
in-memory rather than a persistent Hermes configuration change.

## Decision

The Composer and model-routing UI show only models advertised by Hermes as
`catalogSource: "hermes-config"`. OpenRouter and LM Studio catalogs may enrich
matching Hermes entries with metadata, but catalog-only entries are hidden and
cannot be selected.

Stoix does not expose an "Add model" action until Hermes explicitly advertises a
versioned, authenticated model-configuration write capability. The UI must not
write Hermes config files directly, guess machine-specific paths, or treat a
session override as a persistent model installation. Stoix does not call
OpenRouter inference directly and does not create a second agent runtime.

## Consequences

- OpenRouter metadata can change after its short cache window without changing
  Hermes-configured model ordering.
- Adding a model remains a Hermes capability gap rather than a UI-side best
  effort, so the UI cannot create a model that the installed Hermes version may
  fail to route or persist.
