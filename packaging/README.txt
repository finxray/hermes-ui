Stoix {VERSION}
===============

Stoix is a local Web UI for Hermes Agent. Hermes is a separate runtime and must
be installed and started independently.

Channels
--------
Hermes conversations started in Telegram, Discord, WhatsApp, Slack, and other
configured channels appear in a dedicated folder for that platform when Hermes
reports their source. The channel glyph replaces the folder icon. Opening one
continues the same Hermes session in Stoix. Stoix refreshes channel history
periodically and when its window regains focus. Hermes does not currently expose
its CLI handoff command over HTTP, so Stoix does not show a misleading
send-to-channel control.

Start
-----
Windows: double-click Stoix.cmd
macOS:   double-click Stoix.command (first launch may require Open from Finder)
Linux:   run ./stoix

Stoix binds only to 127.0.0.1 and opens the default browser. The first launch
creates a private config.env file outside this versioned application directory:

Windows: %APPDATA%\Stoix\config.env
macOS:   ~/Library/Application Support/Stoix/config.env
Linux:   $XDG_CONFIG_HOME/stoix/config.env (or ~/.config/stoix/config.env)

The default Hermes URL is http://127.0.0.1:8642. If Hermes requires an API key,
stop Stoix, set HERMES_API_KEY in config.env, and start Stoix again. Never share
that file.

Updates
-------
Settings checks the public finxray/hermes-ui GitHub Releases channel once a day.
Stoix never installs an update without the user's action. Review and download a
new release from the update link shown in Settings.

Data
----
Projects and chats stay in the browser profile (IndexedDB). Replacing this
application folder does not delete browser data or the private config file.

Privacy and notices
-------------------
See PRIVACY.md for the Stoix data-flow disclosure. Node.js license terms are in
NODE_LICENSE.txt; runtime dependency notices are in THIRD_PARTY_NOTICES.txt.
