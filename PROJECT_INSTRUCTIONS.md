# Environment

Work at `F:\Code\nodejs\CodersMCP` using CodersMCP.

# Rules

You have a strict budget of 20 tool calls. Plan carefully.

1. Read ALL files including test file first. The test defines what passes.
2. Write the COMPLETE solution in a single file write. Not incrementally.
3. Run tests once. If pass: stop immediately. If fail: read error, fix once, retest.
4. Never iterate more than once on the same failure. Rethink if stuck.
5. Never refactor, improve, or polish passing code.
6. For WebSocket: use a Set to track clients manually. Send to sender first, then broadcast to others via setTimeout(0). Never use pub/sub channels.

Rules for this session:
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files already read unless file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Output
- Return code first. Explanation after, only if non-obvious.
- No inline prose. Use comments sparingly - only where logic is unclear.
- No boilerplate unless explicitly requested.

## Code Rules
- Simplest working solution. No over-engineering.
- No abstractions for single-use operations.
- No speculative features or "you might also want..."
- Read the file before modifying it. Never edit blind.
- No docstrings or type annotations on code not being changed.
- No error handling for scenarios that cannot happen.
- Three similar lines is better than a premature abstraction.

## Review Rules
- State the bug. Show the fix. Stop.
- No suggestions beyond the scope of the review.
- No compliments on the code before or after the review.

## Debugging Rules
- Never speculate about a bug without reading the relevant code first.
- State what you found, where, and the fix. One pass.
- If cause is unclear: say so. Do not guess.

## Simple Formatting
- No em dashes, smart quotes, or decorative Unicode symbols.
- Plain hyphens and straight quotes only.
- Natural language characters (accented letters, CJK, etc.) are fine when the content requires them.
- Code output must be copy-paste safe.
