# Working on Lirovo Desktop

## The commit type decides the version

release-please reads the commit type and nothing else. Choosing the wrong word
does not just mislabel the change — it publishes the wrong number, and a version
cannot be taken back once somebody's copy has updated to it.

| type | version move | what it is for |
| --- | --- | --- |
| `fix:` | `0.3.0` → `0.3.1` | something was broken and now is not |
| `feat:` | `0.3.0` → `0.4.0` | something exists that did not exist before |
| `feat!:` or `BREAKING CHANGE:` | `0.3.0` → `0.4.0` while under 1.0 | see `bump-minor-pre-major` |
| `chore:` `docs:` `refactor:` `test:` `ci:` | nothing | no release on their own |

Under 1.0 a breaking change bumps the minor, not the major
(`bump-minor-pre-major`). `1.0.0` is a decision somebody makes, never something
a commit message causes.

**A change that fixes two bugs is a `fix:`, even if the fixing involved writing
new code.** This has been got wrong: a PR that repaired a clipped menu and a
button that did nothing was labelled `feat:` because it added a component along
the way, and it published `0.4.0` where `0.3.1` was correct. The question is not
how much was written. It is whether somebody who had the previous version gets
something new, or gets something that was supposed to work all along.

## Verify before the release, not after

The release pipeline is fully automatic, which means nothing stands between a
merge and a signed build that people install. The pipeline proves the app
*builds*. It cannot prove a button does what its label says.

So before merging anything that changes behaviour, exercise it. `pnpm build`
then serve `apps/desktop/dist` with a stubbed bridge, or run the packaged app.
Click the thing. Watch it fail on purpose.

This has been got wrong too: an install button was shipped after proving only
that `npm --version` answered from a login shell. The button itself was never
pressed, and it ran a different command from the one its own row displayed.

## Two surfaces, one vocabulary

`apps/desktop/src/renderer/lib/system-vocabulary.ts` names things. Settings and
the first-run screen both read from it, and from the same doctor report. If one
of them says `Ollama` and the other says `local`, that is a bug in this file and
not in the two screens.

Same rule for commands: `packages/core/src/fixes.ts` is the only table of what
this app will run. A row that displays a command the table does not contain
offers to copy it, never to run it — otherwise the button does something other
than what the line above it says.
