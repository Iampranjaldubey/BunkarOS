# Skill & Agent Routing (binding)

Follow this table. **User instructions beat skills** — if the user says otherwise, do that.
When a decision is needed, present it to the user as **2–4 numbered MCQ options, recommended one first**.

## Routing table
| Trigger | Route |
|---------|-------|
| New feature | brainstorming → `SPECS.md` entry → writing-plans → `TASKS.md` → subagent-driven-development → verification-before-completion |
| Bug / failure / unexpected behavior | systematic-debugging → test-driven-development → verification-before-completion |
| 2+ independent tasks | dispatching-parallel-agents |
| Any UI work | frontend-design + shadcn-ui + accessibility |
| Perf / low-end phone | performance + core-web-vitals |
| Browser testing | webapp-testing (Playwright MCP) |
| Before commit | code-review agent |
| Auth / external input / tokens | security-review agent |
| Large diff | simplify agent |
| About to claim done | verification-before-completion |

## Notes
- Load a skill = read `.kiro/skills/<name>/SKILL.md` and follow it.
- Never claim done/fixed/passing without cited evidence (verification-before-completion).
- Never commit/push/deploy without explicit user "yes".
