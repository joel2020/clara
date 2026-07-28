// Resolves the {name} token in curriculum text against the signed-in learner.
//
// Scenario roles, openers, and starter chips were originally written for one
// named student, which meant every OTHER learner was greeted with someone
// else's name (audit P0). Content now carries a {name} token and this is the
// single place it resolves — client (chips, openers) and server (system
// prompts) share it so the two can never disagree.

/**
 * Replace every {name} token. With no name, the token is removed and the
 * punctuation around it tidied ("Hey {name}!" → "Hey!"), or replaced with
 * `fallback` when a neutral description is better than omission (model-facing
 * text: "meeting {name}" → "meeting the student").
 */
export function personalize(text: string, name?: string | null, fallback?: string): string {
  const n = name?.trim();
  if (n) return text.replaceAll("{name}", n);
  if (fallback) return text.replaceAll("{name}", fallback);
  return text
    .replace(/[ ]*,[ ]*\{name\}/g, "") // ", {name}" → ""
    .replace(/\{name\}[ ]*,[ ]*/g, "") // "{name}, " → ""
    .replace(/[ ]*\{name\}[ ]*/g, " ") // bare token → single space
    .replace(/[ ]+([!?.,;:])/g, "$1") // no space before punctuation
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

/**
 * Personalize a list of learner-facing lines (starter chips). Lines that need
 * a name we don't have are dropped rather than mangled — "Hi, I'm ..." is not
 * something we ask anyone to say.
 */
export function personalizeList(lines: string[], name?: string | null): string[] {
  const n = name?.trim();
  return lines
    .filter((l) => n || !l.includes("{name}"))
    .map((l) => personalize(l, n));
}
