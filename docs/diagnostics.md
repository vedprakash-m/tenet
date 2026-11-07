# Diagnostics

The save destination below is a candidate, not an owner-approved choice.
Inside-project versus outside-project publication remains unresolved.

Tenet does not capture or upload diagnostics automatically. On a user request,
run `node plugin/kernel/tenet.mjs diagnostics` from the project and read the
complete `data.text` preview. The response includes its SHA-256 in `data.hash`
and UTF-8 size in `data.bytes`.

The JSON projection includes kernel version/platform, state schema/revision,
work-state counts and up to 20 recent validated call rows (verb, exit, revision,
timestamp, optional duration/termination/check outcome). Oldest rows are removed
to keep the complete preview within **4,000 bytes**, a conservative bound for
about 4,000 characters. Omitted/invalid calls and other omitted journal records
are counted. Reduced older journal history is not included. Host, model and
permission observations are explicitly unknown.

Requests, outcomes, prompts, source, command output, environment values,
machine paths, arbitrary journal fields and host-reported usage are not copied.
The fixed redaction categories are keys, tokens, credentials, personal paths
and emails. Redaction finds likely sensitive shapes; it is **not a guarantee**
that every secret is removed. Inspect the preview before sharing it.

After previewing, save only on explicit request:

```sh
node plugin/kernel/tenet.mjs diagnostics --save diagnostics.json --preview-hash <data.hash>
```

The chosen path must be a new project-relative `.json` file using `/`
separators, without traversal, `.git` or `.tenet` components. This deliberately
narrows the old proposed arbitrary external-path export design; there is no new
filesystem authority. The file is atomically published, private (0600), never
overwritten and never written through a link. Project exclusions still apply.
A new unignored export changes the Git inventory and check candidate. It is
not assigned to the active contract automatically: finish/commit can ask the
existing unexplained-change question. Answering `not-mine` preserves the file
outside that contract's commit. Keep exported files out of commits or delete
them when no longer needed. Built-bundle attribution observation is pending.

Saving requires initialized local state so the kernel can journal the effect;
without state, copy the preview yourself. If the snapshot changed, the kernel
refuses the old hash: read a new full preview before saving. Interrupted saves
are reconciled from the current bounded file/hash without retries, overwrites
or contract changes. A killed adapter may leave its private temporary file;
automatic orphan cleanup is not claimed.

Windows supports previews but retains the kernel's existing mutation refusal
for saves. Native host request/preview interaction remains **unobserved**.
Matching a preview hash does not prove a human asked or read it. Returning a
preview to the host may send it to the host's model provider; the verb performs
no upload itself. No OpenTelemetry mapping (ENG-06) is implemented.
