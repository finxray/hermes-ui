Stoix {VERSION}
===============

Stoix is an MIT-licensed community-beta Web UI for Hermes Agent. Hermes is a
separate runtime. The recommended installer can invoke Hermes' official
installer on macOS/Linux; the documented Windows beta path uses Hermes inside
WSL2. This portable folder never vendors or silently replaces Hermes.

Expect bugs. The source application has received limited maintainer testing on
macOS and on Windows with Hermes in WSL2. Packaged clean installation has not
yet received maintainer validation, and Linux still needs community testing.

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

If startup fails, run the launcher with --doctor. It reports the package,
configuration path, and Hermes connection without printing credentials.

Updates
-------
Settings checks the public finxray/hermes-ui GitHub Releases channel once a day.
Stoix never installs an update without the user's action. To install the newest
available version on Windows, macOS, or Linux, run:

  stoix update

The command preserves this configuration and all external user-data locations.
It uses the native updater bundled with this verified package and stages a new
version before switching the stable launcher.

Data
----
Projects and chats stay in browser IndexedDB. Durable attachment bytes stay in
Stoix's per-user local data store. Replacing this application folder does not
delete either data location or the private config file.

Privacy and notices
-------------------
See PRIVACY.md for the Stoix data-flow disclosure. Node.js license terms are in
NODE_LICENSE.txt; runtime dependency notices are in THIRD_PARTY_NOTICES.txt.
Stoix license terms are in LICENSE.
