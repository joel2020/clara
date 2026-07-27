// The call simulator's scenarios.
//
// This is the differentiator: Joel stops being a patient tutor and plays an
// American customer with a problem, at natural speed, mildly impatient. She has to
// run the call — open it, verify, empathise, read details back, resolve, close.
//
// The checklist is not decoration. It mirrors what a real BPO quality scorecard
// checks on a recorded call, which is what she will actually be graded on in the
// job. Each scenario carries the digits or details she must read back, because
// mishearing those is the most common real failure.

export type CallDifficulty = "calm" | "annoyed" | "angry";

export interface CallScenario {
  id: string;
  title: { es: string; en: string };
  blurb: { es: string; en: string };
  difficulty: CallDifficulty;
  /** Who the customer is and what they want — feeds the system prompt. */
  persona: string;
  /** The customer's first line. She has to respond to this cold. */
  opener: string;
  /** Details the customer will give that she must read back correctly. */
  details: string[];
  /** What a good agent does on THIS call, beyond the universal four. */
  extra?: string;
}

/** The four universal checks, scored on every call. */
export const QA_CHECKS = [
  { key: "greeted", es: "Saludó y se identificó", en: "Greeted and identified herself" },
  { key: "verified", es: "Verificó la cuenta", en: "Verified the account" },
  { key: "empathized", es: "Reconoció la molestia", en: "Acknowledged the frustration" },
  { key: "resolved", es: "Explicó la solución y el siguiente paso", en: "Explained the fix and the next step" },
] as const;

export type QaKey = (typeof QA_CHECKS)[number]["key"];

export const CALL_SCENARIOS: CallScenario[] = [
  {
    id: "double-charge",
    title: { es: "Cobro doble", en: "Double charge" },
    blurb: { es: "Le cobraron dos veces y nadie le respondió", en: "Charged twice and nobody called back" },
    difficulty: "annoyed",
    persona:
      "You are Denise Miller, 41, from Ohio. You were charged twice for the same order last week, you already called once, and nobody called you back. You are not shouting, but you are tired of repeating yourself and you want it fixed on this call. You will give your order number 4-4-9-2-1-7 if she asks, and your email is d.miller@gmail.com.",
    opener: "Hi, yeah — I got charged twice for the same order and nobody's called me back about it.",
    details: ["449217", "d.miller@gmail.com"],
    extra: "A good agent confirms the amount that was double-charged and tells her when the refund lands.",
  },
  {
    id: "wrong-item",
    title: { es: "Pedido equivocado", en: "Wrong item" },
    blurb: { es: "Llegó el modelo equivocado", en: "The wrong model arrived" },
    difficulty: "calm",
    persona:
      "You are Greg Alvarez, 34, from Texas. You ordered a black wireless keyboard and received a white wired one. You are polite and a little rushed because you are at work. Your order number is 7-1-3-0-5-8. You want a replacement, not a refund.",
    opener: "Hey, so I got my order today but it's the wrong one. I ordered the wireless one.",
    details: ["713058", "black wireless keyboard"],
    extra: "A good agent confirms what he wants (replacement, not refund) rather than assuming.",
  },
  {
    id: "late-delivery",
    title: { es: "Entrega retrasada", en: "Late delivery" },
    blurb: { es: "Lo necesitaba para hoy y no llegó", en: "Needed it today and it never came" },
    difficulty: "angry",
    persona:
      "You are Karen Whitfield, 52, from Florida. Your package was guaranteed for today because it is a birthday gift, and the tracking has not moved in three days. You are genuinely angry and you interrupt at first. You calm down if she acknowledges the problem instead of reading a script at you. Your tracking number is 9-9-0-4-2-3. If she tells you to calm down, you get angrier.",
    opener: "This is completely unacceptable. I paid for guaranteed delivery and the tracking hasn't moved in three days.",
    details: ["990423"],
    extra:
      "A good agent acknowledges the birthday deadline specifically and offers something concrete, not just an apology.",
  },
  {
    id: "cancel-account",
    title: { es: "Quiere cancelar", en: "Wants to cancel" },
    blurb: { es: "Cansado de un cobro que no reconoce", en: "Tired of a charge he does not recognise" },
    difficulty: "annoyed",
    persona:
      "You are Tom Becker, 29, from Illinois. You want to cancel your subscription because you saw a $14.99 charge you do not recognise. If she explains the charge clearly and fairly, you are willing to stay. If she tries to hard-sell you before explaining it, you insist on cancelling. Your account email is tbecker29@outlook.com.",
    opener: "I want to cancel my account. There's a charge on here I never signed up for.",
    details: ["14.99", "tbecker29@outlook.com"],
    extra: "A good agent explains the charge BEFORE trying to retain him, and never argues about whether he agreed.",
  },
  {
    id: "cant-log-in",
    title: { es: "No puede entrar", en: "Cannot log in" },
    blurb: { es: "Contraseña rechazada una y otra vez", en: "Password rejected over and over" },
    difficulty: "calm",
    persona:
      "You are Susan Park, 61, from Oregon. You cannot log in and you are not very confident with technology, so you need instructions one step at a time and you will ask her to repeat things. You are friendly and apologetic. Your email is s.park1963@yahoo.com.",
    opener: "Hello? Yes, I'm having trouble getting into my account. It keeps saying my password is wrong.",
    details: ["s.park1963@yahoo.com"],
    extra: "A good agent gives ONE step at a time and checks she followed before moving on.",
  },
];

export function getCallScenario(id: string): CallScenario | undefined {
  return CALL_SCENARIOS.find((s) => s.id === id);
}
