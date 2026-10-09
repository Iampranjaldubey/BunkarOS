# Claude-Code → Kiro tool translation

The superpowers skills are written for Claude Code. Translate wording as follows.

| Skill says | In Kiro, do |
|------------|-------------|
| **Skill** tool / "use the X skill" | Load it: read `.kiro/skills/<name>/SKILL.md` and follow it |
| **Task** / **Agent** tool | Kiro `subagent` tool with agents: `sp-implementer`, `sp-reviewer`, `sp-final-reviewer`, `sp-explorer` |
| **TodoWrite** | `todo_list` tool **and** mirror in `TASKS.md` |
| **AskUserQuestion** | Numbered MCQ in chat (2–4 options, recommended first) |
| `${CLAUDE_PLUGIN_ROOT}` or `./file` | Path relative to that skill's folder |
| SDD progress ledger | `.superpowers/sdd/<plan>/progress.md` — mirror status in `TASKS.md` |

## Agent mapping (SDD roles)
- `sp-implementer` — does the implementation task
- `sp-reviewer` — reviews a task's output
- `sp-final-reviewer` — final gate before done
- `sp-explorer` — codebase/research investigation

## Fallback
If no `subagent` tool is available, use the **executing-plans** skill (inline execution).
