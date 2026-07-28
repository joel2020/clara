#!/usr/bin/env python3
# One-off Phase 0 content repair. Exact-string replacements only; every pair
# was verified against the live inventory (scripts/scan-hints.mjs) so a miss
# is a hard error. Deleted after use? No — kept out of the app bundle; it
# documents exactly what changed.
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "lib" / "content"

# (file, old, new) — hints: stop respelling /h/ as Spanish j and /θ ð/ as z.
# Convention per docs/pronunciation-standard.md: respell h as 'h' (+"soplada"
# cue where h is the teaching point), th stays 'th' with an articulatory cue.
HINTS = [
    ("conversation.ts",
     "Una sola ola: jai-jauaryú. La h es un soplido suave.",
     "Una sola ola: 'hai-hau-ar-yú'. La h es un soplido suave, nunca una j fuerte."),
    ("conversation.ts",
     "'do you' se relaja: 'jau-da-yu-séi'. Úsala en cada clase.",
     "'do you' se relaja: 'hau-da-yu-séi'. Úsala en cada clase."),
    ("conversation.ts",
     "Plantilla universal: 'jau-da-ai-GET-tu...' + lugar.",
     "Plantilla universal: 'hau-da-ai-GET-tu...' + lugar. La h, un soplido suave."),
    ("conversation.ts",
     "'How's' = jau-z, con z. Sube en 'going?'.",
     "'How's' = 'hauz', termina en z suave. Sube en 'going?'."),
    ("conversation.ts",
     "Se une todo: 'ja-va-gud-DEI'. Despídete siempre así.",
     "Se une todo: 'ha-va-gud-DEI', h suave. Despídete siempre así."),
    ("conversation.ts",
     "'How's it' se une: 'jau-sit-GO-in'. El saludo americano diario.",
     "'How's it' se une: 'hau-sit-GO-in'. El saludo americano diario."),
    ("conversation-2.ts",
     "Se encadena: 'jang-ON-a-SE-kend'.",
     "Se encadena: 'hang-ON-a-SE-kend', con h soplada al inicio."),
    ("conversation-2.ts",
     "Se junta: 'jau-MACH-i-sit'. Tu pregunta para comprar todo.",
     "Se junta: 'hau-MACH-i-sit'. Tu pregunta para comprar todo."),
    ("conversation-2.ts",
     "'half' con f, la l no suena: 'jaf-PRAIS'.",
     "'half' con f, la l no suena: 'haf-PRAIS'. La h, un soplido."),
    ("conversation-2.ts",
     "Dos TH seguidas: 'zri-ZER-ti'. Hora + minutos.",
     "Dos TH seguidas: lengua entre los dientes y sopla, nunca t ni s. Hora + minutos."),
    ("conversation-2.ts",
     "'How's' = 'jaus'. Pregunta cálida para empezar.",
     "'How's' = 'hauz', con h suave. Pregunta cálida para empezar."),
    ("conversation-2.ts",
     "'work' con r americana. 'jom' con h soplada.",
     "'work' con r americana. 'home' = 'houm', con h soplada."),
    ("conversation-2.ts",
     "'jau-was-yor-DEI'. Pregunta de cada tarde.",
     "'hau-was-yor-DEI', h suave. Pregunta de cada tarde."),
    ("conversation-2.ts",
     "Dos TH: 'zank...EV-ri-zing'. Al despedirte.",
     "Dos TH, lengua entre los dientes: 'thank' y 'every-thing'. Al despedirte."),
    ("conversation-2.ts",
     "'throat' con TH + r: 'zrout'. 'hurts' = duele.",
     "'throat': TH con la lengua entre los dientes + r americana. 'hurts' = duele."),
    ("conversation-2.ts",
     "'help me' se junta: 'jelp-mi'. Directa y clara.",
     "'help me' se junta: 'help-mi', con h soplada. Directa y clara."),
    ("conversation-2.ts",
     "'Who's' = 'jus'. 'KO-ling'.",
     "'Who's' = 'huz', con h suave — la w no suena. 'KO-ling'."),
    ("conversation-2.ts",
     "'hear me' se junta: 'jir-mi'. Para la mala señal.",
     "'hear me' se junta: 'hir-mi', con h suave. Para la mala señal."),
    ("conversation-2.ts",
     "Fuerte y directa. 'nid-JELP'.",
     "Fuerte y directa: 'nid-HELP', con h soplada."),
    ("conversation-2.ts",
     "'lost' termina en 'st'. 'foun' con h muda... no, 'f'.",
     "'lost' termina en 'st'. 'phone' suena 'foun' — la ph es una f."),
    ("conversation-3.ts",
     "'think' con la lengua afuera: 'zink' no, 'th'.",
     "'think': lengua entre los dientes y sopla — nunca t ni s."),
    ("conversation-4.ts",
     "Palabra larga; sepárala: 'jai-po-zé-ti-kli'.",
     "Palabra larga; sepárala: 'hai-po-THE-ti-kli' — th con la lengua entre los dientes."),
    ("conversation-support.ts",
     "Se junta: 'jau-ka-nai-HELP-yu'.",
     "Se junta: 'hau-ka-nai-HELP-yu', con h soplada."),
]

# IPA: British /ɒ/ → GenAm. Word-specific first (the words whose GenAm vowel is
# NOT /ɑː/), then the generic LOT-set fallback. Verified against Merriam-Webster
# GenAm transcriptions.
IPA = [
    ("wɒz", "wʌz"),          # was
    ("bɪˈkɒz", "bɪˈkʌz"),    # because
    ("rɒŋ", "rɔːŋ"),          # wrong (CLOTH before ŋ)
    ("ˈɒfər", "ˈɔːfər"),      # offer (CLOTH)
    ("ˈpɒlɪsi", "ˈpɑːləsi"),  # policy
    ("ɒ", "ɑː"),              # remaining LOT set: stop, want, honest, sorry, not…
]

FILES = ["lessons.ts", "conversation.ts", "conversation-2.ts", "conversation-3.ts",
         "conversation-4.ts", "conversation-support.ts"]
texts = {f: (ROOT / f).read_text() for f in FILES}
changed = 0
for _, old, new in HINTS:  # first tuple element is a hint, not authoritative
    hits = [f for f in FILES if old in texts[f]]
    if not hits and any(new in texts[f] for f in FILES):
        continue  # already applied (idempotent)
    if len(hits) != 1:
        sys.exit(f"MISS ({len(hits)} hits): {old!r}")
    texts[hits[0]] = texts[hits[0]].replace(old, new)
    changed += 1
for old, new in IPA:
    for f in FILES:
        n = texts[f].count(old)
        if n:
            texts[f] = texts[f].replace(old, new)
            changed += n
for f in FILES:
    (ROOT / f).write_text(texts[f])

print(f"applied {changed} replacements")
