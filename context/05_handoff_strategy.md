# 05_handoff_strategy

## Session Checkpointing Protocol

- When the user requests a snapshot or a handoff (for example, "Generate handoff"), automatically generate a root-level `handoff.md` file.
- Trigger this protocol if token consumption appears excessive, hallucination loops begin, or the session context becomes unwieldy.
- The handoff file must be generated at the project root, not inside `context/`.

## Handoff File Structure

The generated `handoff.md` file must contain the following exact structure:

- ## Current Objective:
  - Explicitly state what task or feature was being actively built in the current run.

- ## Completed Work & State:
  - Provide a clean list of files modified, features successfully integrated, and confirmed database migrations.

- ## Blockers & Friction Points:
  - Explain exactly where code generation failed, loops occurred, or API testing halted.

- ## Explicit Next Steps for the Incoming Agent:
  - Provide a strict, sequential task list written directly to the next AI engine, detailing exactly where to place its focus to pick up the task flawlessly.

## Operational Expectations

- Do not delay creation of `handoff.md` when the trigger conditions are met.
- Maintain the file as the single canonical checkpoint artifact for session continuation or reset.
- Keep the content concise, factual, and actionable for the incoming agent.
