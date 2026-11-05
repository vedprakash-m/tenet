Push only when the user asks to push or to publish the work. An acceptance or "ok" is never that request.

1. Run `tenet decide remote --h <handle> --target origin` (use the remote the user named; add `{"propose": {"branch": "<name>"}}` on stdin to push to another branch). It returns the chat question `remote-confirm` and the advisory `approval-gate` reason.
2. Show the remote, its URL, the branch and the commit exactly as the question states them. Ask in plain chat and end your turn.
3. On "push", run the same `tenet decide remote --h <handle> --target origin` again with `--answer remote-confirm=push` and the user's words as `quote`. On "cancel", answer `remote-confirm=cancel`.
4. Then run `tenet publish push --h <handle>`. It refuses with `authority-needed` if the remote, its URL, the branch or the commit changed since the user agreed; tell the user what changed and start again from step 1.

Pull requests are not built: `tenet publish pr --h <handle>` refuses with `capability-missing`. Push the branch, then tell the user to open the pull request themselves. A rejected push (`repo-state-readonly`) sent nothing: report Git's reason and do not retry with force.
