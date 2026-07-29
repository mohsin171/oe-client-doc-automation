#!/usr/bin/env python3
"""The rest of the letters a firm sends across the life of a matter.

Everything here is fictional and illustrative. No real firm, client or matter.

Two corpora existed: engagement letters, sent when a client is taken on, and closing
letters, sent when the work is done. Between those two a firm sends a great deal more,
and until now the system had nothing to learn from for any of it.

Five types, twenty letters each:

  status_update       Where the matter has got to. Probably the most frequent letter
                      in the building, and the one nobody enjoys writing.
  chasing_letter      Documents or money outstanding. Almost entirely drawn from what
                      the file already knows is missing.
  client_care         The regulatory letter, sent alongside or instead of terms.
  completion          Confirming what happened, at the point it happened.
  estimate_revision   Work has exceeded the quote. The firm's own standard clause
                      promises this one in writing, so it has to exist.

Each carries the firm's house style, so the counting finds the same protected clauses
it finds in the other two. Each also carries genuine variation, because twenty copies
of one shape would teach the engine nothing.
"""

import pathlib
import random

random.seed(90210)

FIRM = "Harrow & Fenn Solicitors"
ADDRESS = "18 Bishopsgate Row, Leeds LS1 4TQ"

# The firm's own wording, carried across every kind of letter it sends. A firm does not
# change its complaints clause because the letter is a chase rather than an engagement.
HOUSE = {
    "confidential": "Private and confidential",
    "complaints": (
        "We are committed to providing a high standard of service. If you are unhappy "
        "with any aspect of the service you receive, or with a bill, please raise it in "
        "the first instance with the supervising partner named in this letter, who will "
        "investigate and respond to you in writing. If we are unable to resolve your "
        "complaint, you may be entitled to refer it to the Legal Ombudsman. Harrow & "
        "Fenn Solicitors is authorised and regulated by the Solicitors Regulation "
        "Authority."
    ),
    "data": (
        "We will process your personal data in accordance with applicable data "
        "protection law and with our privacy notice, a copy of which is available on "
        "request. We will retain your file for six years following the conclusion of "
        "this matter, after which it may be destroyed without further notice to you."
    ),
    "contact": (
        "If anything in this letter is unclear, or if your circumstances have changed in "
        "a way we should know about, please telephone or write to the fee earner named "
        "below rather than waiting for our next letter."
    ),
}

CLIENTS = [
    ("Mr Gareth Pemberton", "23 Shadwell Lane, Leeds LS17 6DA", "Mr Pemberton"),
    ("Ms Rosalind Achebe", "9 Burley Lodge Terrace, Leeds LS6 1QP", "Ms Achebe"),
    ("Cawthorne Fabrications Limited", "Bay 4, Stourton Link, Leeds LS10 1RJ", "Sirs"),
    ("Mrs Lydia Frankland", "51 Talbot Road, Leeds LS8 1LZ", "Mrs Frankland"),
    ("Mr and Mrs D Okonkwo", "17 Grange Croft, Leeds LS17 7EW", "Mr and Mrs Okonkwo"),
    ("Dr Alasdair Menzies", "88 Headingley Mount, Leeds LS6 3EQ", "Dr Menzies"),
    ("Mr Nathaniel Boakye", "5 Beckett Grove, Leeds LS9 6DL", "Mr Boakye"),
    ("Mrs Wendy Threlfall", "62 Adel Lane, Leeds LS16 8DE", "Mrs Threlfall"),
    ("Miss Orla Devaney", "11 Blenheim Walk, Leeds LS2 9AZ", "Miss Devaney"),
    ("Ms Farrah Kazemi", "34 Woodhouse Cliff, Leeds LS6 2HG", "Ms Kazemi"),
    ("Brindley Wharf Estates Limited", "Suite 6, Sovereign Quay, Leeds LS1 4BJ", "Sirs"),
    ("Mr Duncan Rylance", "73 Chapeltown Road, Leeds LS7 4EE", "Mr Rylance"),
]

EARNERS = [
    ("Sarah Fenn", "Partner"),
    ("James Harrow", "Partner"),
    ("Priya Nandra", "Senior Associate"),
    ("Tom Whitcombe", "Associate"),
]

AREAS = [
    ("residential-conveyancing", "Purchase of {property}"),
    ("probate-and-estate-administration", "Estate of {deceased} deceased"),
    ("employment", "Settlement agreement with {employer}"),
    ("family", "Divorce and financial settlement"),
    ("commercial-lease", "New lease of {premises}"),
]

PROPS = ["14 Sandhill Oval, Leeds LS17 8EG", "3 Grosvenor Mount, Leeds LS6 2DX",
         "62 Wood Nook Drive, Leeds LS16 7AJ", "The Old Bindery, Marshall Street, Leeds LS11 9YJ"]
DEC = ["Mrs Marjorie Thrale", "Mr Cyril Bawden", "Mrs Enid Carncross", "Mr Reginald Vasey"]
EMP = ["Cawthorne Fabrications Limited", "Sedgwick Precision Limited", "Halewood & Pike Limited"]
PREM = ["Unit 9, Airedale Business Court, Leeds LS12 6AB",
        "Ground Floor, 8 Park Cross Street, Leeds LS1 2QH",
        "Workshop 3, Feeder Road, Leeds LS10 1JQ"]

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August"]


def fill_for(i):
    return {
        "property": PROPS[i % len(PROPS)],
        "deceased": DEC[i % len(DEC)],
        "employer": EMP[i % len(EMP)],
        "premises": PREM[i % len(PREM)],
    }


def head(i, ref_seq, extra_confidential=True):
    client, address, salutation = CLIENTS[i % len(CLIENTS)]
    earner, grade = EARNERS[i % len(EARNERS)]
    area_key, subject_tpl = AREAS[i % len(AREAS)]
    subject = subject_tpl.format(**fill_for(i))
    date = f"{random.randint(2, 27)} {MONTHS[i % len(MONTHS)]} 2026"
    ref = f"HF/2026/{ref_seq}"
    lines = [FIRM, ADDRESS, "", f"Our reference: {ref}", date, ""]
    if extra_confidential:
        lines += [HOUSE["confidential"], ""]
    lines += [client, address, "", f"Dear {salutation},", "", f"Re: {subject}", ""]
    return lines, (earner, grade), area_key, subject


def tail(earner, grade, with_data=True):
    lines = []
    if with_data:
        lines += ["Data protection", "", HOUSE["data"], ""]
    lines += ["If something goes wrong", "", HOUSE["complaints"], "",
              HOUSE["contact"], "",
              "Yours sincerely,", "", earner, grade, FIRM]
    return lines


# ---------------------------------------------------------------------------
# status_update
# ---------------------------------------------------------------------------

STATUS_STAGES = {
    "residential-conveyancing": [
        "We have received the draft contract and title pack from the seller's solicitors and have begun our review.",
        "The searches have been submitted and we are waiting for the local authority result, which is the one that usually takes longest.",
        "We have raised pre-contract enquiries and are waiting for replies before we can advise you on exchange.",
        "Replies to our enquiries have been received and we are now in a position to report to you on the contract.",
    ],
    "probate-and-estate-administration": [
        "We have written to each of the asset holders for valuations and are waiting for their replies.",
        "The probate application has been submitted and we are waiting for the grant to issue.",
        "The grant has issued and we are collecting in the assets of the estate.",
        "The assets have been collected and we are preparing the estate accounts for your approval.",
    ],
    "employment": [
        "We have reviewed the draft agreement and are putting our proposed amendments to the employer's solicitors.",
        "The employer's solicitors have responded to our amendments and we are considering their position.",
        "Agreement has been reached on the principal terms and we are waiting for an engrossed copy to sign.",
    ],
    "family": [
        "The application has been issued and we are waiting for the court to acknowledge it.",
        "We have provided your financial disclosure and are waiting for the same from the other side.",
        "Disclosure has been exchanged and we are considering the settlement proposal that has been made.",
        "Terms have been agreed in principle and we are drafting the consent order for approval.",
    ],
    "commercial-lease": [
        "We have reported to you on the draft lease and are negotiating the points you asked us to pursue.",
        "The landlord's solicitors have agreed most of our amendments and we are pressing on the remainder.",
        "The lease is agreed in substance and we are working towards completion.",
    ],
}

WAITING_ON = [
    "the local authority, whose current turnaround is outside our control",
    "the other side's solicitors, whom we have chased in writing",
    "a third party from whom we have requested information",
    "the court, whose listing times we cannot influence",
]


def status_update(i, seq):
    lines, (earner, grade), area, subject = head(i, seq)
    stages = STATUS_STAGES[area]
    stage = stages[i % len(stages)]

    lines += [
        "Why we are writing", "",
        "We are writing to let you know where your matter has got to and what happens "
        "next. You do not need to do anything in response to this letter unless we say "
        "so below.",
        "",
        "Where the matter stands", "", stage, "",
    ]

    if i % 3 == 0:
        lines += [
            "What we are waiting for", "",
            f"Progress currently depends on {WAITING_ON[i % len(WAITING_ON)]}. We will "
            "tell you as soon as that changes.",
            "",
        ]

    if i % 4 == 0:
        lines += [
            "What we need from you", "",
            "Please let us have the documents listed in our earlier letter when you can. "
            "We cannot move to the next stage without them.",
            "",
        ]

    spent = random.randrange(400, 3200, 50)
    lines += [
        "Costs to date", "",
        f"Our charges on this matter to date are {spent:,} pounds plus VAT. This remains "
        "within the estimate we gave you, and we will write to you before that changes.",
        "",
    ]
    # A status update does not restate the data clause. The engagement letter did.
    lines += tail(earner, grade, with_data=False)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# chasing_letter
# ---------------------------------------------------------------------------

OUTSTANDING = [
    ["your signed terms of engagement", "proof of identity for each of you"],
    ["the completed instruction questionnaire", "your mortgage offer"],
    ["the death certificate", "the original will"],
    ["your bank statements for the last twelve months"],
    ["the signed authority we sent you", "a copy of your passport"],
    ["the employer's correspondence you mentioned"],
]


def chasing_letter(i, seq):
    lines, (earner, grade), area, subject = head(i, seq)
    items = OUTSTANDING[i % len(OUTSTANDING)]
    asked_on = f"{random.randint(2, 27)} {MONTHS[(i + 5) % len(MONTHS)]} 2026"

    lines += [
        "Why we are writing", "",
        f"We wrote to you on {asked_on} asking for the items listed below and have not "
        "yet received them. We cannot take your matter further until we do.",
        "",
        "What is still outstanding", "",
        "\n".join(f"- {x}" for x in items),
        "",
        "Why it matters", "",
    ]

    if i % 3 == 0:
        lines += [
            "There is a deadline on this matter which we cannot extend on your behalf, and "
            "a delay now may mean it is missed. If there is a difficulty in providing any "
            "of the above, tell us and we will see what can be done.",
            "",
        ]
    else:
        lines += [
            "Until these are received your file is on hold. That does not affect the work "
            "already done, but nothing further will happen and any timescale we have given "
            "you will move accordingly.",
            "",
        ]

    if i % 5 == 0:
        held = random.randrange(150, 900, 50)
        lines += [
            "Money on account", "",
            f"We also hold {held:,} pounds on account, which is applied to our charges as "
            "they arise. Nothing further is due from you at present.",
            "",
        ]

    lines += tail(earner, grade, with_data=False)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# client_care
# ---------------------------------------------------------------------------

def client_care(i, seq):
    lines, (earner, grade), area, subject = head(i, seq)
    rate = random.choice([190, 215, 265, 320, 340])

    lines += [
        "Who is dealing with your matter", "",
        f"Your matter is being handled by {earner}, {grade}, who is your day to day "
        "contact. If they are unavailable and the matter is urgent, any member of the "
        "team can help, and the supervising partner named at the end of this letter has "
        "overall responsibility.",
        "",
        "How we will keep you informed", "",
        "We will write to you at each significant stage and whenever a decision is needed "
        "from you. If a matter is quiet for any length of time we will still write, so "
        "that you are never left wondering where it has got to.",
        "",
        "How we charge", "",
        f"Our charges are calculated on an hourly basis at {rate} pounds per hour, "
        "exclusive of VAT. We record time in units of six minutes and account to you for "
        "it. Where we have given you an estimate we will not exceed it without discussing "
        "it with you first and obtaining your authority in writing.",
        "",
        "Your right to complain", "", HOUSE["complaints"], "",
        "Your right to challenge a bill", "",
        "You may also be entitled to apply to the court for an assessment of our bill "
        "under the Solicitors Act 1974. Any such application is subject to time limits, "
        "and the Legal Ombudsman may not consider a complaint about a bill that is the "
        "subject of court proceedings.",
        "",
    ]

    if i % 4 == 0:
        lines += [
            "Insurance", "",
            "We carry professional indemnity insurance as required by our regulator. "
            "Details of the insurer and the territorial coverage are available on request.",
            "",
        ]

    lines += ["Data protection", "", HOUSE["data"], "",
              HOUSE["contact"], "",
              "Yours sincerely,", "", earner, grade, FIRM]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# completion
# ---------------------------------------------------------------------------

COMPLETED = {
    "residential-conveyancing": ("completed your purchase of {property} today",
                                 "The keys are available for collection from the estate agent."),
    "probate-and-estate-administration": ("obtained the grant of probate in the estate of {deceased}",
                                          "A sealed copy of the grant is enclosed."),
    "employment": ("concluded your settlement agreement with {employer}",
                   "A signed copy of the agreement is enclosed for your records."),
    "family": ("obtained the court's approval of your consent order",
               "A sealed copy of the order is enclosed."),
    "commercial-lease": ("completed the grant of your new lease of {premises}",
                         "The counterpart lease is enclosed."),
}


def completion(i, seq):
    lines, (earner, grade), area, subject = head(i, seq)
    did, enclosure = COMPLETED[area]
    did = did.format(**fill_for(i))

    lines += [
        "What has happened", "",
        f"We are pleased to confirm that we have {did}. {enclosure}",
        "",
        "What happens next", "",
    ]

    if area == "residential-conveyancing":
        lines += [
            "We will now register your title at the Land Registry. That usually takes some "
            "months and is outside our control. We will send you the updated register as "
            "soon as it is issued.",
            "",
        ]
    elif area == "probate-and-estate-administration":
        lines += [
            "We will now collect in the assets of the estate, settle the liabilities, and "
            "prepare estate accounts for your approval before anything is distributed.",
            "",
        ]
    else:
        lines += [
            "There is nothing further for you to do. We will close our file shortly and "
            "will write to you separately with our final account.",
            "",
        ]

    if i % 3 == 0:
        lines += [
            "Points to note", "",
            "Please keep the enclosed documents somewhere safe. We hold a copy on our file "
            "but the originals are yours and may be needed later.",
            "",
        ]

    lines += tail(earner, grade, with_data=False)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# estimate_revision
# ---------------------------------------------------------------------------

REASONS = [
    "the other side has raised a point that was not apparent at the outset and which we have had to address",
    "the volume of documentation has turned out to be substantially greater than we were told",
    "a third party has been slower than expected, which has meant repeated chasing and further correspondence",
    "your instructions have changed in a way that widens the work we agreed to do",
    "a title defect has come to light which requires separate investigation",
]


def estimate_revision(i, seq):
    lines, (earner, grade), area, subject = head(i, seq)
    original = random.randrange(1200, 4000, 100)
    revised = original + random.randrange(400, 1800, 50)
    spent = original - random.randrange(0, 300, 50)
    reason = REASONS[i % len(REASONS)]

    lines += [
        "Why we are writing", "",
        "Our terms of engagement say that we will not exceed the estimate we gave you "
        "without discussing it with you first and obtaining your authority in writing. "
        "This letter is that discussion.",
        "",
        "What has changed", "",
        f"When we accepted your instructions we estimated our charges at {original:,} "
        f"pounds plus VAT. Our charges to date are {spent:,} pounds plus VAT. We now "
        f"expect the total to be in the region of {revised:,} pounds plus VAT.",
        "",
        f"The reason is that {reason}.",
        "",
        "What we are asking", "",
        "Please confirm in writing that you are content for us to continue on the revised "
        "basis. We will not carry out further chargeable work until you do, other than "
        "anything necessary to protect your position in the meantime.",
        "",
        "Your alternatives", "",
        "You are not obliged to agree. You may ask us to limit our work to a particular "
        "sum, you may ask us to stop, or you may take the matter elsewhere, and we will "
        "help you move the file. In each case you would owe us for work properly done up "
        "to that point.",
        "",
    ]

    if i % 4 == 0:
        lines += [
            "If you would like to discuss it", "",
            "We would rather talk this through than exchange letters. Telephone the fee "
            "earner named below and we will find a time.",
            "",
        ]

    # An estimate revision restates it, because it is a letter about the terms.
    lines += tail(earner, grade, with_data=True)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------

TYPES = {
    "status-update": (status_update, 5000),
    "chasing-letter": (chasing_letter, 5200),
    "client-care": (client_care, 5400),
    "completion": (completion, 5600),
    "estimate-revision": (estimate_revision, 5800),
}


def main():
    import collections
    import re

    for slug, (fn, base) in TYPES.items():
        out = pathlib.Path(f"corpus-{slug}")
        out.mkdir(exist_ok=True)
        for f in out.glob("*.txt"):
            f.unlink()

        texts = []
        for i in range(20):
            text = fn(i, base + i)
            area = AREAS[i % len(AREAS)][0]
            (out / f"{i+1:02d}-{area}-{slug}-HF-2026-{base+i}.txt").write_text(text, encoding="utf-8")
            texts.append(text)

        paras = collections.Counter()
        for t in texts:
            for p in {" ".join(q.split()) for q in re.split(r"\n\s*\n", t)
                      if len(" ".join(q.split())) >= 12}:
                paras[p] += 1
        inv = [p for p, n in paras.items() if n == 20]
        avg = sum(len(t) for t in texts) // len(texts)

        house_found = sum(1 for k, v in HOUSE.items()
                          if all(v in t for t in texts))
        print(f"{slug:20} 20 letters, {len(inv):>2} in all twenty, "
              f"{len(paras)-len(inv):>3} varying, {avg} chars avg, "
              f"{house_found}/{len(HOUSE)} house clauses in every letter")


if __name__ == "__main__":
    main()
