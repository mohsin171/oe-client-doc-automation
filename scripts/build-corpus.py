#!/usr/bin/env python3
"""
Builds an illustrative corpus for the demo firm, Harrow & Fenn Solicitors.

Everything here is fictional. The point is not that the wording is model legal
drafting, it is that the corpus behaves like a real firm's output: the same
protective clauses appear word for word in every letter, while the scope, fees,
dates and parties differ every time.

That is what makes the demo work. Upload the pile, and the clauses that never
change are, by definition, the firm's standard terms. Nobody marks anything up.
"""

import json, random, textwrap
from pathlib import Path
from datetime import date, timedelta

random.seed(11)

OUT = Path("corpus")
OUT.mkdir(exist_ok=True)

FIRM = "Harrow & Fenn Solicitors"
ADDRESS = "18 Bishopsgate Row, Leeds LS1 4TQ"

# ---------------------------------------------------------------------------
# Clauses that are identical in every single letter. These are what the system
# should detect as protected, purely by observing that they never vary.
# ---------------------------------------------------------------------------

FIXED = {
    "confidential": "Private and confidential",

    "intro": (
        "Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on "
        "which we will act for you, the scope of the work we have agreed to carry out, and the "
        "basis on which we will charge for it. Please read it carefully and keep it with your "
        "papers. If anything in it does not match your understanding of what we discussed, please "
        "tell us before we begin work."
    ),

    "fee_cap": (
        "We will not exceed the estimate set out above without first discussing it with you and "
        "obtaining your written authority to continue. If it becomes clear at any stage that the "
        "work will cost materially more than we have estimated, we will write to you with a "
        "revised figure and the reasons for it before incurring further charges."
    ),

    "responsibilities": (
        "So that we can act effectively for you, we ask that you provide us with clear instructions "
        "and with all documents and information relevant to this matter, that you tell us promptly "
        "of any change in your circumstances or contact details, and that you inform us without "
        "delay if your instructions change or if you receive any communication from another party "
        "about this matter."
    ),

    "data": (
        "We will process your personal data in accordance with applicable data protection law and "
        "with our privacy notice, a copy of which is available on request. We will retain your file "
        "for six years following the conclusion of this matter, after which it may be destroyed "
        "without further notice to you."
    ),

    "complaints": (
        "We are committed to providing a high standard of service. If you are unhappy with any "
        "aspect of the service you receive, or with a bill, please raise it in the first instance "
        "with the supervising partner named in this letter, who will investigate and respond to you "
        "in writing. If we are unable to resolve your complaint, you may be entitled to refer it to "
        "the Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the "
        "Solicitors Regulation Authority."
    ),

    "terms": (
        "Our standard terms of business apply to this engagement and are enclosed with this letter. "
        "Where anything in this letter conflicts with those terms, this letter takes precedence."
    ),
}

# ---------------------------------------------------------------------------
# Everything below differs from letter to letter.
# ---------------------------------------------------------------------------

FEE_EARNERS = [
    ("Sarah Fenn", "Partner", 320),
    ("Daniel Okoye", "Senior Associate", 265),
    ("Priya Raval", "Associate", 215),
    ("Tom Harrow", "Partner", 340),
    ("Aisha Bello", "Solicitor", 190),
]
SUPERVISORS = ["Sarah Fenn", "Tom Harrow"]

MATTERS = [
    {
        "type": "Residential conveyancing",
        "subject": "Purchase of {prop}",
        "scope": [
            "We will act for you in connection with your purchase of the freehold property at {prop}. "
            "Our work includes reviewing the contract and title supplied by the seller's solicitors, "
            "raising and reporting on the usual searches and pre-contract enquiries, reporting to you "
            "in writing before exchange, exchanging contracts on your instructions, and completing the "
            "purchase and registering your title at HM Land Registry.",
            "Our work does not include advice on the physical condition or valuation of the property, "
            "advice on the tax consequences of the purchase, or any dispute arising after completion. "
            "We would be pleased to advise separately on any of these if you wish.",
        ],
        "timescale": "A straightforward purchase of this kind usually takes {weeks} weeks from receipt "
                     "of the contract pack, although this depends on the other parties in the chain.",
    },
    {
        "type": "Probate and estate administration",
        "subject": "Estate of {deceased} deceased",
        "scope": [
            "We will act for you in the administration of the estate of {deceased}, who died on {dod}. "
            "Our work includes identifying and valuing the assets and liabilities of the estate, "
            "preparing the application for a grant of probate, submitting the relevant inheritance tax "
            "account, collecting in the assets once the grant is issued, settling liabilities, and "
            "preparing estate accounts for your approval before distribution.",
            "Our work does not include advice on the personal tax position of individual beneficiaries, "
            "the sale of any property forming part of the estate, which would be a separate matter, or "
            "any contentious claim brought against the estate.",
        ],
        "timescale": "Estates of this nature are typically concluded within {months} months, although "
                     "the timing of the grant is outside our control.",
    },
    {
        "type": "Commercial lease",
        "subject": "Lease of {prop}",
        "scope": [
            "We will act for you in connection with the grant of a new commercial lease of {prop}. "
            "Our work includes reviewing the draft lease and any agreement for lease, negotiating the "
            "terms with the landlord's solicitors, reporting to you on the principal obligations "
            "including rent review, repair and alienation, and completing the lease.",
            "Our work does not include advice on the commercial merits of the transaction, the "
            "physical condition of the premises, or any planning or licensing application that may be "
            "required for your intended use.",
        ],
        "timescale": "Negotiation and completion of a lease of this kind usually takes {weeks} weeks, "
                     "depending on the landlord's solicitors.",
    },
    {
        "type": "Employment",
        "subject": "Settlement agreement",
        "scope": [
            "We will act for you in connection with the settlement agreement offered to you by your "
            "employer. Our work includes reviewing the agreement, advising you on its terms and effect "
            "and in particular on the claims you would be giving up, discussing with you whether the "
            "financial terms are reasonable, and signing the adviser's certificate required for the "
            "agreement to be binding.",
            "Our work does not include negotiating the financial terms with your employer unless you "
            "instruct us separately to do so, nor does it include bringing any claim in the Employment "
            "Tribunal.",
        ],
        "timescale": "Advice of this kind is usually completed within {weeks} weeks of receiving the "
                     "draft agreement.",
    },
    {
        "type": "Family",
        "subject": "Divorce and financial arrangements",
        "scope": [
            "We will act for you in connection with your divorce and the financial arrangements arising "
            "from it. Our work includes preparing and issuing the divorce application, corresponding "
            "with the court and with your spouse's solicitors, advising you on the disclosure of "
            "financial information, and advising on any proposal for settlement.",
            "Our work does not include arrangements for children, which would be a separate matter, "
            "nor does it include representation at a final hearing, for which we would instruct counsel "
            "and write to you separately about the costs.",
        ],
        "timescale": "The timing of a divorce is largely governed by the court timetable and by the "
                     "statutory periods, which currently mean a minimum of around {months} months.",
    },
]

CLIENTS = [
    ("Mrs Elaine Whitcombe", "4 Priory Gardens, Leeds LS8 2QT"),
    ("Mr Raymond Osei", "112 Cardigan Lane, Leeds LS4 2LE"),
    ("Northgate Property Holdings Limited", "Unit 7, Kirkstall Business Park, Leeds LS5 3BF"),
    ("Ms Priya Raval", "31 Cranmer Bank, Leeds LS17 5DA"),
    ("Mr and Mrs J Alderton", "8 Wentworth Crescent, Harrogate HG2 9QT"),
    ("Dr Miriam Cole", "56 Hyde Park Road, Leeds LS6 1AL"),
    ("Bellweather Trading Limited", "3rd Floor, Wellington Place, Leeds LS1 4AP"),
    ("Mr Stephen Duffy", "19 Otley Old Road, Leeds LS16 6HB"),
    ("Mrs Hannah Iqbal", "77 Roundhay Grove, Leeds LS8 4DP"),
    ("Mr Callum Reid", "2 Cross Flatts Avenue, Leeds LS11 7BG"),
    ("Fairhurst Joinery Limited", "Sowerby Works, Bramley, Leeds LS13 2QN"),
    ("Ms Yvonne Baptiste", "14 Chapel Allerton Rise, Leeds LS7 4NF"),
    ("Mr Peter Lindqvist", "40 Weetwood Lane, Leeds LS16 5NR"),
    ("Mrs Susan Ainsworth", "6 Church Wood Mount, Leeds LS16 5AR"),
]

PROPERTIES = [
    "4 Priory Gardens, Leeds LS8 2QT",
    "Unit 7, Kirkstall Business Park, Leeds LS5 3BF",
    "112 Cardigan Lane, Leeds LS4 2LE",
    "8 Wentworth Crescent, Harrogate HG2 9QT",
    "3rd Floor, Wellington Place, Leeds LS1 4AP",
    "19 Otley Old Road, Leeds LS16 6HB",
    "Sowerby Works, Bramley, Leeds LS13 2QN",
]

DECEASED = [
    "Mr Arthur Whitcombe", "Mrs Doreen Pickles", "Mr Ronald Baptiste",
    "Miss Edith Marchbank", "Mr George Ainsworth",
]


def money(n):
    return f"\u00a3{n:,}"


def salutation(name):
    """UK convention: title plus surname, or Sirs for a company."""
    if name.endswith("Limited") or name.endswith("Ltd"):
        return "Sirs"
    parts = name.split()
    titles = {"Mr", "Mrs", "Ms", "Miss", "Dr", "Professor"}
    if parts[0] in titles:
        return f"{parts[0]} {parts[-1]}"
    if name.startswith("Mr and Mrs"):
        return f"Mr and Mrs {parts[-1]}"
    return parts[-1]


def build_letter(i):
    matter = random.choice(MATTERS)
    client, client_addr = CLIENTS[i % len(CLIENTS)]
    earner, grade, rate = random.choice(FEE_EARNERS)
    supervisor = random.choice(SUPERVISORS)

    prop = random.choice(PROPERTIES)
    deceased = random.choice(DECEASED)
    dod = (date(2026, 1, 1) - timedelta(days=random.randint(30, 400))).strftime("%d %B %Y")
    letter_date = (date(2026, 1, 6) + timedelta(days=random.randint(0, 190)))

    weeks = random.choice([6, 8, 10, 12, 14])
    months = random.choice([6, 9, 12, 18])
    hours = random.choice([8, 10, 12, 15, 18, 22, 26])
    estimate = rate * hours
    disbursements = random.choice([250, 340, 480, 620, 950])

    ref = f"HF/2026/{100 + i:03d}"
    subject = matter["subject"].format(prop=prop, deceased=deceased)

    scope = [
        p.format(prop=prop, deceased=deceased, dod=dod) for p in matter["scope"]
    ]
    timescale = matter["timescale"].format(weeks=weeks, months=months)

    fees = (
        f"Our charges for this matter will be calculated on an hourly basis at a rate of "
        f"{money(rate)} per hour, exclusive of VAT. On the basis of what you have told us, we "
        f"estimate that this matter will take in the region of {hours} hours, giving an estimate "
        f"of {money(estimate)} plus VAT. In addition you should allow approximately "
        f"{money(disbursements)} for disbursements, which are payments we make on your behalf to "
        f"third parties."
    )

    handler = (
        f"This matter will be handled by {earner}, {grade}, who will be your day to day contact. "
        f"The partner with overall supervision of this matter is {supervisor}."
    )

    parts = [
        FIXED["confidential"],
        "",
        FIRM,
        ADDRESS,
        "",
        f"Our reference: {ref}",
        letter_date.strftime("%d %B %Y"),
        "",
        client,
        client_addr,
        "",
        f"Dear {salutation(client)},",
        "",
        f"Re: {subject}",
        "",
        FIXED["intro"],
        "",
        "Scope of our work",
        "",
        scope[0],
        "",
        scope[1],
        "",
        "Our charges",
        "",
        fees,
        "",
        FIXED["fee_cap"],
        "",
        "Timescales",
        "",
        timescale,
        "",
        "Who will act for you",
        "",
        handler,
        "",
        "Your responsibilities",
        "",
        FIXED["responsibilities"],
        "",
        "Data protection",
        "",
        FIXED["data"],
        "",
        "If something goes wrong",
        "",
        FIXED["complaints"],
        "",
        FIXED["terms"],
        "",
        "Please sign and return the enclosed copy of this letter to confirm your agreement to "
        "these terms so that we may begin work.",
        "",
        "Yours sincerely,",
        "",
        earner,
        f"{grade}",
        FIRM,
    ]

    body = "\n".join(parts)
    wrapped = "\n".join(
        textwrap.fill(line, 92) if len(line) > 92 else line for line in body.split("\n")
    )

    return {
        "ref": ref,
        "doc_type": "engagement_letter",
        "matter_type": matter["type"],
        "client": client,
        "fee_earner": earner,
        "rate": rate,
        "estimate": estimate,
        "date": letter_date.isoformat(),
        "text": wrapped,
    }


letters = [build_letter(i) for i in range(20)]

index = []
for i, l in enumerate(letters, start=1):
    name = f"{i:02d}-{l['matter_type'].lower().replace(' ', '-')}-{l['ref'].replace('/', '-')}.txt"
    (OUT / name).write_text(l["text"], encoding="utf-8")
    index.append({k: v for k, v in l.items() if k != "text"} | {"file": name})

(OUT / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")

# Verify the boilerplate really is identical everywhere. If it is not, the
# invariant detection has nothing to find and the demo falls flat.
print(f"{len(letters)} letters written to {OUT}/\n")
print("Boilerplate consistency check:")
for key, clause in FIXED.items():
    probe = clause[:70]
    hits = sum(1 for l in letters if probe.replace("\n", " ") in l["text"].replace("\n", " "))
    flag = "ok " if hits == len(letters) else "!! "
    print(f"  {flag}{key:18} appears in {hits}/{len(letters)}")

print("\nVariation check:")
print(f"  matter types : {len({l['matter_type'] for l in letters})}")
print(f"  clients      : {len({l['client'] for l in letters})}")
print(f"  fee earners  : {len({l['fee_earner'] for l in letters})}")
print(f"  rates        : {sorted({l['rate'] for l in letters})}")
