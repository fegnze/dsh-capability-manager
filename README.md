# dsh-capability-manager

English | [中文](<docs/zh.md>)

One page to manage **Skills**, **MCP servers** and installable **Assistants**, with an additive assistant selector in the conversation input toolbar. Official DSH services retain ownership of package installation, native presets, Skills, MCP and Agent execution; the assistant base owns only assistant capability declarations and explicit per-session bindings.

Community DSH desktop plugin, compatible with DSH 0.2.1-rc.2.

## Status

Assistant support is under the native OpenSpec change `add-assistant-packages`. Local unit/transport tests, native-runtime tests, installed activation and actual desktop acceptance are separate checks. Package presence is not evidence of successful binding; publication and registry availability must be verified independently.

## Why one plugin

A filesystem Skill remains a native discovered directory; an MCP server remains a configuration row of official `@deepseek-ai/dsh-mcp-client`. An assistant is a separate cohesive DSH bundle containing its implementation and resources. This repository supplies one shared manager/base, not every assistant's business code.

## Entry point

Open **Skills • MCP • Assistants** next to **Plugins** in the sidebar. The three-tab page is separate from Settings. Choose an assistant in the session input toolbar; selecting one is not starting a model task. Install/remove assistant bundles through the official Plugins page, which owns Desktop installation, build approvals and restart feedback. Use the **desktop** profile; do not start another Web profile or edit profile files by hand.

## Skills

Discovery belongs to `@deepseek-ai/dsh-skill-filesystem`; sessions read it through the native `skills` service. The panel groups the native catalog by project, global and bundled sources and reads instructions on demand.

The only default local management paths are `~/.agents/skills` and `<project>/.agents/skills`. Verified local skills offer **Open folder** and **Delete**. Bundled, virtual, linked or unauthorized sources remain read-only. Deleting one effective skill may expose a lower-priority namesake; it is a separate item, not deleted automatically. Installation is not offered.

Deletion keeps files in a sibling recovery area as a fallback, not as a skill restoration service. Recovery shows existing files and an optional text preview, with **Open folder** and per-item removal to macOS Trash. There is no restore-to-original-location action or original-location display; deleted files are not guaranteed to remain valid skills. Safety backups remain outside discovery. A short confirmation lists affected files before deletion.

## MCP

MCP servers are configuration, not files. This plugin owns the servers listed in its own configuration form and mounts each enabled one as a native `mcp-client` child, persisting through the official config editor.

- Servers managed by other plugins or the profile are listed **read-only** with the reason, so the page never claims authority it does not have.
- A new server is added from standard MCP JSON in one confirmed action that imports it and starts it. The same execution check as a toggle still applies: a stdio entry whose environment would inject interpreter or loader variables is refused before anything starts.
- Status is configured/enabled, not "connected": a process may fail to start, and no tool result proves the remote service is healthy.

## Assistants

Assistant declarations and the public integration contract are documented in [the runtime contract](<src/assistants/contract.md>). A package is installed through native Plugin Manager and registers a strict manifest, read-only readiness check and scoped mount callback. Its content digest covers runtime code and resources; it detects drift, not hostile installed code or a cryptographic supply-chain signature.

A session starts unbound. The toolbar previews exact package identity and prerequisites, then the authenticated owner confirms binding. The first release supports **one assistant for the life of the session**, without defaults, replacement or unbinding. A matching preset can be used in an idle existing session. Automatic native preset selection is permitted only before the first turn; a started incompatible session records a blocked selection and receives a copyable new-session instruction. Exact-identity retries can repair configuration; upgrades need a new session.

Bindings use official `storageDomain` plus a standard session-inbox evidence projection. Restore checks exact identity and preset before enabling package capabilities. Missing evidence, corrupt state, content drift or a removed package blocks work instead of silently continuing without the assistant. Ordinary package/base teardown does not erase user projects, credentials, shared MCP or binding intent.

The toolbar adds controls, not a replacement submit button. It displays blocked/preparing state but cannot disable the host's composer without an official admission hook. Host step admission is the final check: a rejected step consumes its claimed input, **not a queue hold**. The base does not automatically resubmit it. A completely removed/disabled base has no interception point and cannot guard future cold resumes; restore the base or use a new session. Simultaneous destruction of both binding storage and session evidence is not detectable.

Assistant tools enforce their own baselines and authorization; they do not claim to prevent every alternate shell/MCP path. Subagent recipes use native provider capabilities and lifecycle, with explicit preset/model/context choices and no automatic child assistant binding. No new daemon, Agent host or workflow database is created.

## Authorization

HTTP requests require signed-peer admission, an owner principal and a plugin intent header; responses are never cached. Mutations additionally require the host's authenticated browser peer, shared by the browser UI and Electron desktop forwarding; owner API peers cannot mutate. Host admission validates the authority, origin fence and signed session cookie. Electron forwards without Origin or Fetch Metadata headers, so this plugin does not require those headers to exist. Agent tools can inspect and preview, and cannot approve or commit a change.

## Configuration

`roots` grants local Skill directories; each entry needs `id`, absolute `path`, `trusted: true` and `recoveryOutsideDiscovery: true` (the owner's assertion that the sibling state directory is outside **every** actual discovery root, including preset and custom providers that this plugin cannot enumerate). Additional `roots` are optional; empty configuration still allows deletion management in the two existing `.agents/skills` default directories. Missing default directories are not created. Project contexts must come from a live agent or registered workspace, never an arbitrary browser path. `servers` is this plugin's own MCP list.

Installing the bundle starts no MCP server unless enabled servers are configured. Default directories do not grant arbitrary filesystem access or installation/editing permission.

## Limitations

- Local Skill management is a restricted **macOS** adapter for trusted owner-local roots with cooperative modification. It is not a hostile same-user race boundary, and it is not an official cross-platform Skill installation API.
- A successful file change does not prove the skill is active: discovery, shadowing by a nearer root, preset scoping and invocation policy are all decided by native mechanisms. Check the chosen session, and remember a catalog entry is not an invocation.
- MCP enable/disable persists and reconciles through the Loader, which may interrupt in-flight tool calls. A started process is not a health check.
- No marketplace, no credential storage, no provider-configuration writes, no execution of imported scripts.
- Discovery is one directory level deep: `<root>/<name>/SKILL.md` and `<root>/<name>.md` only.

## Development

Run `node --test test/*.test.mjs`. Keep controller/HTTP/React DOM tests separate from native-runtime and actual desktop acceptance. This assistant-system migration uses native OpenSpec with the owner's explicit exemption from legacy devkit enforcement. The replacement development assistant becomes the domain tool authority only after parity and desktop acceptance; public publication still requires authorization and independent package verification.
