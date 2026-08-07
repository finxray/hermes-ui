# Stoix Privacy Notice

Stoix is local software. It does not provide a Stoix cloud account, analytics
service, advertising service, or telemetry endpoint in version `0.1.0`.

## Data Stored Locally

Projects, chats, session metadata, and UI settings are stored in the browser
profile on the user's computer. Hermes connection settings and credentials are
stored in the user's private Stoix `config.env` file when using the portable
package. They are not embedded in the application archive.

## Data Sent Outside Stoix

Prompts, attachments selected by the user, model choices, and session context
are sent to the user-configured Hermes runtime. Hermes and its configured model
providers, tools, plugins, and skills have their own data-handling behavior and
policies. Stoix displays and orchestrates those services; it does not control
their retention.

The update checker contacts the public `finxray/hermes-ui` GitHub Releases API
at most once every 24 hours, or when the user chooses Check now. Standard network
metadata such as IP address and user agent may therefore be received by GitHub.

## User Control

Users can reset local Stoix workspace data from Settings, remove the Stoix
browser profile, delete the per-user `config.env`, or stop using the configured
Hermes runtime. Review this notice together with the policies of any Hermes
provider or plugin before sending sensitive information.

This notice describes the `0.1.0` software behavior and should be reviewed by
the project owner before public release.
