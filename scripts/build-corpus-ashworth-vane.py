#!/usr/bin/env python3
"""Twenty letters from a second firm, for testing ingestion on unseen wording.

Everything here is fictional and illustrative. No real firm, client, matter or
address appears.

The point of a second corpus is that it should share nothing with the first. If
the engine only works on letters written to suit it, that is worth discovering
now rather than in front of a prospect. So this differs deliberately:

  Different firm, different areas of work. Commercial contracts, intellectual
  property, landlord and tenant, immigration. None of the four in the first set.

  Different boilerplate, in different words. Nine standard clauses rather than
  eight, worded as this firm would word them, so nothing can match by accident.

  Different structure. Numbered headings, a fixed-fee firm rather than an hourly
  one, VAT quoted inclusive, and a client care sentence in a different place.

  Different lengths. Some letters carry an extra clause about counsel or about
  a third party, so the invariant count has to survive genuine variation rather
  than twenty copies of one shape.
"""

import pathlib
import random

random.seed(1908)

FIRM = "Ashworth Vane LLP"
FIRM_ADDRESS = "Second Floor, 14 Cranmer Court, Bristol BS1 5TR"

# The nine paragraphs this firm puts in every engagement letter. Worded to share
# as little as possible with the first corpus, so a match means the counting
# worked rather than that the two sets happen to overlap.
STANDARD = {
    "purpose": (
        "This letter records what you have asked us to do, what it will cost, and the "
        "terms on which we accept the instruction. It replaces anything discussed before "
        "today. Please read it and tell us at once if it does not match your "
        "understanding, because we will begin work on the basis set out here."
    ),
    "fee_certainty": (
        "The figure quoted below is fixed. We will not ask you for more than it unless "
        "the work changes in a way we have described to you in writing and you have "
        "agreed in writing to the revised figure. If the work turns out to be simpler "
        "than expected we will reduce the fee accordingly."
    ),
    "who_does_the_work": (
        "Work on your file may be carried out by any member of the team under the "
        "supervision of the partner named at the end of this letter. Where we consider "
        "that a specialist is needed we will tell you before instructing one, together "
        "with the cost."
    ),
    "what_we_need": (
        "We can only act on what we are told. Please give us the documents we ask for "
        "promptly, tell us if anything you have already told us changes, and forward any "
        "correspondence you receive about this matter without replying to it yourself."
    ),
    "confidentiality": (
        "What you tell us stays between us, except where the law requires disclosure or "
        "where you ask us to share it. We are obliged to verify your identity and to "
        "report certain matters to the authorities, and we cannot tell you if we have "
        "done so."
    ),
    "data": (
        "We hold your information for as long as we are required to and for six years "
        "after this matter closes, after which it is destroyed securely. Our privacy "
        "notice explains what we hold and why, and is available on request or on our "
        "website."
    ),
    "complaints": (
        "If any part of our service falls short, please tell the supervising partner "
        "named below, who will look into it and reply within fourteen days. If we cannot "
        "put it right between us you may take the matter to the Legal Ombudsman. "
        "Ashworth Vane LLP is regulated by the Solicitors Regulation Authority."
    ),
    "ending": (
        "You may end this instruction at any time by telling us in writing, and you will "
        "owe us for work properly done up to that point. We may only stop acting for good "
        "reason, and if we do we will explain why and help you move the file elsewhere."
    ),
    "acceptance": (
        "If you are content with the above, please confirm by return. We will treat your "
        "confirmation as your agreement to these terms and will start work."
    ),
}

# Work this firm does. Deliberately none of the four in the first corpus.
AREAS = {
    "commercial-contracts": {
        "subject": "Review of the {counterparty} supply agreement",
        "scope": [
            "You have asked us to review the draft supply agreement sent to you by "
            "{counterparty} and to advise on the terms that carry risk for you. We will "
            "read the agreement, report to you in writing on the clauses we would want "
            "changed, and prepare a marked-up version for you to send back to them.",
            "We will advise on the liability cap, the indemnities, the termination "
            "provisions and the treatment of your own materials. We will also tell you "
            "where the agreement is silent on something that matters.",
        ],
        "excluded": [
            "We are not advising on the commercial merits of the deal, on tax, or on "
            "whether the price is right.",
            "Negotiating directly with {counterparty} is not included. If you would like "
            "us to take that on we will agree a separate figure with you first.",
        ],
        "fee": (1400, 2600),
        "weeks": (2, 4),
    },
    "intellectual-property": {
        "subject": "Protection of the {brand} name",
        "scope": [
            "You have asked us to advise on protecting the {brand} name and to apply to "
            "register it as a trade mark in the United Kingdom. We will carry out "
            "clearance searches, advise you on the classes to apply in, prepare and file "
            "the application, and deal with the Intellectual Property Office until the "
            "mark is registered or refused.",
            "Where the searches show an earlier mark that may cause difficulty we will "
            "tell you before filing, so that you can decide whether to proceed, to change "
            "the mark, or to stop.",
        ],
        "excluded": [
            "Applications outside the United Kingdom are not included in this figure.",
            "If a third party opposes the application, defending it is separate work and "
            "we will write to you with the cost before doing anything.",
        ],
        "fee": (900, 1800),
        "weeks": (12, 20),
    },
    "landlord-and-tenant": {
        "subject": "New lease of {premises}",
        "scope": [
            "You have asked us to act on the grant of a new lease of {premises}. We will "
            "review the draft lease, report to you on its terms in writing, negotiate the "
            "points we have identified with the other side's solicitors, and complete the "
            "grant once you are content.",
            "We will advise you on the rent review provisions, the repairing obligation, "
            "the alienation clause and whether the lease is inside or outside the security "
            "of tenure provisions of the Landlord and Tenant Act 1954.",
        ],
        "excluded": [
            "We are not advising on the level of rent, on the condition of the premises, "
            "or on whether the premises suit your business. You should take your own "
            "advice from a surveyor.",
            "Any dispute arising after completion is not covered by this letter.",
        ],
        "fee": (1600, 3200),
        "weeks": (4, 8),
    },
    "immigration": {
        "subject": "Application for a {route} visa",
        "scope": [
            "You have asked us to prepare and submit your application for a {route} visa. "
            "We will advise you on the requirements, tell you which documents are needed, "
            "check what you provide, complete the application, and submit it with our "
            "covering representations.",
            "We will keep you informed of progress and will deal with any request for "
            "further information from the Home Office up to the point a decision is made.",
        ],
        "excluded": [
            "Home Office fees, the immigration health surcharge and any translation or "
            "courier costs are payable by you in addition to our fee.",
            "An appeal or an administrative review, if the application is refused, is "
            "separate work and we would agree a figure with you before starting it.",
        ],
        "fee": (1100, 2200),
        "weeks": (6, 14),
    },
}

CLIENTS = [
    ("Bramwell Foods Limited", "Unit 7, Kestrel Way, Avonmouth BS11 8DQ", "Sirs"),
    ("Mr Idris Bello", "42 Sefton Park Road, Bristol BS7 9AL", "Mr Bello"),
    ("Larkfield Studios Limited", "3 Colston Yard, Bristol BS1 5BD", "Sirs"),
    ("Ms Priya Raghunathan", "18 Wellington Hill, Bristol BS7 8ST", "Ms Raghunathan"),
    ("Mrs Coral Ntim", "9 Ashley Down Road, Bristol BS7 9BJ", "Mrs Ntim"),
    ("Halewood Joinery Limited", "The Old Sawmill, Pill BS20 0AB", "Sirs"),
    ("Mr Tomasz Wieczorek", "61 North Street, Bristol BS3 1EN", "Mr Wieczorek"),
    ("Dr Amara Okonjo", "27 Cotham Brow, Bristol BS6 6AR", "Dr Okonjo"),
    ("Peverell Trading Limited", "Suite 4, 200 Whiteladies Road, Bristol BS8 2XZ", "Sirs"),
    ("Miss Fenella Crisp", "5 Berkeley Crescent, Bristol BS8 1HA", "Miss Crisp"),
    ("Mr and Mrs H Dalgleish", "88 Hampton Road, Bristol BS6 6JE", "Mr and Mrs Dalgleish"),
    ("Sancreed Print Limited", "Bay 2, Feeder Road, Bristol BS2 0TQ", "Sirs"),
]

FEE_EARNERS = [
    ("Nadia Ashworth", "Partner"),
    ("Gregory Vane", "Partner"),
    ("Imelda Fitzhugh", "Senior Associate"),
    ("Callum Reece", "Associate"),
]

SUPERVISORS = [("Nadia Ashworth", "Partner"), ("Gregory Vane", "Partner")]

COUNTERPARTIES = ["Meridian Wholesale Limited", "Draycott Logistics Limited",
                  "Kestrel Packaging Limited", "Ferndown Produce Limited"]
BRANDS = ["HEARTHSTONE", "LARKFIELD", "NORTHVANE", "CRISP & CO"]
PREMISES = ["Unit 12, Brunel Trade Park, Bristol",
            "The Ground Floor, 44 Park Street, Bristol",
            "Workshop 3, Feeder Road, Bristol",
            "The First Floor, 9 Queen Square, Bristol"]
ROUTES = ["Skilled Worker", "Global Talent", "Innovator Founder", "Spouse"]

MONTHS = ["January", "February", "March", "April", "May", "June"]


def money(n):
    return f"{n:,}"


def build(i, area_key):
    area = AREAS[area_key]
    client, address, salutation = CLIENTS[i % len(CLIENTS)]
    earner, earner_grade = FEE_EARNERS[i % len(FEE_EARNERS)]
    supervisor, supervisor_grade = SUPERVISORS[i % len(SUPERVISORS)]

    fill = {
        "counterparty": COUNTERPARTIES[i % len(COUNTERPARTIES)],
        "brand": BRANDS[i % len(BRANDS)],
        "premises": PREMISES[i % len(PREMISES)],
        "route": ROUTES[i % len(ROUTES)],
    }

    fee = random.randrange(area["fee"][0], area["fee"][1], 50)
    vat = round(fee * 0.2)
    weeks = random.randint(*area["weeks"])
    ref = f"AV/{2026}/{3100 + i}"
    date = f"{random.randint(2, 27)} {MONTHS[i % len(MONTHS)]} 2026"

    subject = area["subject"].format(**fill)
    scope = [p.format(**fill) for p in area["scope"]]
    excluded = [p.format(**fill) for p in area["excluded"]]

    numbered = []

    def para(heading, body):
        numbered.append((heading, body))

    para("Purpose of this letter", STANDARD["purpose"])
    para("What we will do", " ".join(scope))
    para("What is not included", " ".join(excluded))
    para(
        "Our fee",
        f"Our fee for this work is {money(fee)} pounds plus VAT of {money(vat)} pounds, "
        f"giving {money(fee + vat)} pounds in total. We will invoice on completion of the "
        f"work described above unless we agree something different with you in writing.",
    )
    para("Certainty of the figure", STANDARD["fee_certainty"])
    para(
        "How long it should take",
        f"On the information we have, we expect this to take in the region of {weeks} weeks "
        f"from the date you confirm these terms. Where the timetable depends on a third "
        f"party we will tell you, and we will let you know promptly if it slips.",
    )
    para("Who will do the work", STANDARD["who_does_the_work"])
    para("What we need from you", STANDARD["what_we_need"])
    para("Confidentiality and identity checks", STANDARD["confidentiality"])
    para("Your information", STANDARD["data"])
    para("If something goes wrong", STANDARD["complaints"])
    para("Ending the instruction", STANDARD["ending"])

    # Genuine variation: some letters carry an extra clause, so the invariant
    # count has to survive difference rather than twenty copies of one shape.
    if i % 4 == 0:
        para(
            "Counsel",
            "If we consider that the opinion of counsel would help, we will discuss it with "
            "you and agree the cost before instructing anyone.",
        )
    if i % 5 == 0:
        para(
            "Payments on account",
            "We may ask you for a payment on account before starting work of this kind. Any "
            "sum held is applied to our invoice and anything left over is returned to you.",
        )

    para("Acceptance", STANDARD["acceptance"])

    lines = [
        FIRM,
        FIRM_ADDRESS,
        "",
        f"Our reference: {ref}",
        date,
        "",
        "Private and confidential",
        "",
        client,
        address,
        "",
        f"Dear {salutation},",
        "",
        subject,
        "",
    ]

    for n, (heading, body) in enumerate(numbered, start=1):
        lines.append(f"{n}. {heading}")
        lines.append("")
        lines.append(body)
        lines.append("")

    lines += [
        "Yours faithfully,",
        "",
        earner,
        earner_grade,
        FIRM,
        "",
        f"Supervising partner: {supervisor}, {supervisor_grade}",
    ]

    return "\n".join(lines) + "\n"


def main():
    out = pathlib.Path("corpus-ashworth-vane")
    out.mkdir(exist_ok=True)
    for f in out.glob("*.txt"):
        f.unlink()

    keys = list(AREAS)
    written = []
    for i in range(20):
        area = keys[i % len(keys)]
        text = build(i, area)
        name = f"{i+1:02d}-{area}-AV-2026-{3100+i}.txt"
        (out / name).write_text(text, encoding="utf-8")
        written.append((name, area, text))

    print(f"{len(written)} letters written to {out}/\n")

    print("Boilerplate consistency (what the counting should find):")
    for label, body in STANDARD.items():
        n = sum(1 for _, _, t in written if body in t)
        mark = "ok " if n == 20 else "   "
        print(f"  {mark}{label:26} in {n}/20")

    print("\nVariation (what should not be counted as standard):")
    for label, needle in [
        ("counsel clause", "opinion of counsel"),
        ("payments on account", "payment on account"),
    ]:
        n = sum(1 for _, _, t in written if needle in t)
        print(f"     {label:26} in {n}/20")

    areas = {}
    for _, a, _ in written:
        areas[a] = areas.get(a, 0) + 1
    print("\nAreas of work:")
    for a, n in sorted(areas.items()):
        print(f"     {a:26} {n}")

    avg = sum(len(t) for _, _, t in written) // len(written)
    print(f"\nAverage length: {avg} characters")


if __name__ == "__main__":
    main()
