-- Illustrative corpus for the demo firm, Harrow & Fenn Solicitors.
-- Twenty fictional engagement letters. Nothing here relates to a real client,
-- a real matter, or real legal advice. Safe to re-run.

DELETE FROM precedents WHERE firm_id = (SELECT id FROM firms WHERE slug = 'harrow-fenn')
  AND section_key LIKE 'corpus:%';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/100', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/100
23 February 2026

Mrs Elaine Whitcombe
4 Priory Gardens, Leeds LS8 2QT

Dear Mrs Whitcombe,

Re: Settlement agreement

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with the settlement agreement offered to you by your
employer. Our work includes reviewing the agreement, advising you on its terms and effect
and in particular on the claims you would be giving up, discussing with you whether the
financial terms are reasonable, and signing the adviser''s certificate required for the
agreement to be binding.

Our work does not include negotiating the financial terms with your employer unless you
instruct us separately to do so, nor does it include bringing any claim in the Employment
Tribunal.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £190 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 22 hours, giving an estimate of £4,180 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Advice of this kind is usually completed within 8 weeks of receiving the draft agreement.

Who will act for you

This matter will be handled by Aisha Bello, Solicitor, who will be your day to day contact.
The partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Aisha Bello
Solicitor
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/101', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/101
23 May 2026

Mr Raymond Osei
112 Cardigan Lane, Leeds LS4 2LE

Dear Mr Osei,

Re: Estate of Mrs Doreen Pickles deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mrs Doreen Pickles, who died on
17 October 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £320 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £4,800 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 18 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Sarah Fenn, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Sarah Fenn
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/102', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/102
21 January 2026

Northgate Property Holdings Limited
Unit 7, Kirkstall Business Park, Leeds LS5 3BF

Dear Sirs,

Re: Estate of Mr George Ainsworth deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr George Ainsworth, who died on
31 October 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £190 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 10 hours, giving an estimate of £1,900 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 9 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Aisha Bello, Solicitor, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Aisha Bello
Solicitor
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/103', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/103
18 May 2026

Ms Priya Raval
31 Cranmer Bank, Leeds LS17 5DA

Dear Ms Raval,

Re: Purchase of 8 Wentworth Crescent, Harrogate HG2 9QT

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your purchase of the freehold property at 8 Wentworth
Crescent, Harrogate HG2 9QT. Our work includes reviewing the contract and title supplied by
the seller''s solicitors, raising and reporting on the usual searches and pre-contract
enquiries, reporting to you in writing before exchange, exchanging contracts on your
instructions, and completing the purchase and registering your title at HM Land Registry.

Our work does not include advice on the physical condition or valuation of the property,
advice on the tax consequences of the purchase, or any dispute arising after completion. We
would be pleased to advise separately on any of these if you wish.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £340 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £5,100 plus VAT. In addition you
should allow approximately £250 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

A straightforward purchase of this kind usually takes 8 weeks from receipt of the contract
pack, although this depends on the other parties in the chain.

Who will act for you

This matter will be handled by Tom Harrow, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Tom Harrow
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/104', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/104
06 July 2026

Mr and Mrs J Alderton
8 Wentworth Crescent, Harrogate HG2 9QT

Dear Mr Alderton,

Re: Purchase of 8 Wentworth Crescent, Harrogate HG2 9QT

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your purchase of the freehold property at 8 Wentworth
Crescent, Harrogate HG2 9QT. Our work includes reviewing the contract and title supplied by
the seller''s solicitors, raising and reporting on the usual searches and pre-contract
enquiries, reporting to you in writing before exchange, exchanging contracts on your
instructions, and completing the purchase and registering your title at HM Land Registry.

Our work does not include advice on the physical condition or valuation of the property,
advice on the tax consequences of the purchase, or any dispute arising after completion. We
would be pleased to advise separately on any of these if you wish.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £340 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 26 hours, giving an estimate of £8,840 plus VAT. In addition you
should allow approximately £340 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

A straightforward purchase of this kind usually takes 10 weeks from receipt of the contract
pack, although this depends on the other parties in the chain.

Who will act for you

This matter will be handled by Tom Harrow, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Tom Harrow
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/105', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/105
18 April 2026

Dr Miriam Cole
56 Hyde Park Road, Leeds LS6 1AL

Dear Dr Cole,

Re: Divorce and financial arrangements

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your divorce and the financial arrangements arising
from it. Our work includes preparing and issuing the divorce application, corresponding with
the court and with your spouse''s solicitors, advising you on the disclosure of financial
information, and advising on any proposal for settlement.

Our work does not include arrangements for children, which would be a separate matter, nor
does it include representation at a final hearing, for which we would instruct counsel and
write to you separately about the costs.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £215 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £3,225 plus VAT. In addition you
should allow approximately £250 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

The timing of a divorce is largely governed by the court timetable and by the statutory
periods, which currently mean a minimum of around 12 months.

Who will act for you

This matter will be handled by Priya Raval, Associate, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Priya Raval
Associate
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/106', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/106
12 April 2026

Bellweather Trading Limited
3rd Floor, Wellington Place, Leeds LS1 4AP

Dear Sirs,

Re: Purchase of Unit 7, Kirkstall Business Park, Leeds LS5 3BF

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your purchase of the freehold property at Unit 7,
Kirkstall Business Park, Leeds LS5 3BF. Our work includes reviewing the contract and title
supplied by the seller''s solicitors, raising and reporting on the usual searches and pre-
contract enquiries, reporting to you in writing before exchange, exchanging contracts on
your instructions, and completing the purchase and registering your title at HM Land
Registry.

Our work does not include advice on the physical condition or valuation of the property,
advice on the tax consequences of the purchase, or any dispute arising after completion. We
would be pleased to advise separately on any of these if you wish.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £320 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £2,560 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

A straightforward purchase of this kind usually takes 12 weeks from receipt of the contract
pack, although this depends on the other parties in the chain.

Who will act for you

This matter will be handled by Sarah Fenn, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Sarah Fenn
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/107', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/107
09 January 2026

Mr Stephen Duffy
19 Otley Old Road, Leeds LS16 6HB

Dear Mr Duffy,

Re: Estate of Mr Ronald Baptiste deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr Ronald Baptiste, who died on
15 June 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £215 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 10 hours, giving an estimate of £2,150 plus VAT. In addition you
should allow approximately £340 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 6 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Priya Raval, Associate, who will be your day to day contact.
The partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Priya Raval
Associate
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/108', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/108
29 June 2026

Mrs Hannah Iqbal
77 Roundhay Grove, Leeds LS8 4DP

Dear Mrs Iqbal,

Re: Purchase of 8 Wentworth Crescent, Harrogate HG2 9QT

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your purchase of the freehold property at 8 Wentworth
Crescent, Harrogate HG2 9QT. Our work includes reviewing the contract and title supplied by
the seller''s solicitors, raising and reporting on the usual searches and pre-contract
enquiries, reporting to you in writing before exchange, exchanging contracts on your
instructions, and completing the purchase and registering your title at HM Land Registry.

Our work does not include advice on the physical condition or valuation of the property,
advice on the tax consequences of the purchase, or any dispute arising after completion. We
would be pleased to advise separately on any of these if you wish.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £320 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £4,800 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

A straightforward purchase of this kind usually takes 14 weeks from receipt of the contract
pack, although this depends on the other parties in the chain.

Who will act for you

This matter will be handled by Sarah Fenn, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Sarah Fenn
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/109', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/109
17 April 2026

Mr Callum Reid
2 Cross Flatts Avenue, Leeds LS11 7BG

Dear Mr Reid,

Re: Estate of Miss Edith Marchbank deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Miss Edith Marchbank, who died on
04 October 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £265 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £2,120 plus VAT. In addition you
should allow approximately £480 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 9 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Daniel Okoye, Senior Associate, who will be your day to day
contact. The partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Daniel Okoye
Senior Associate
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/110', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/110
09 June 2026

Fairhurst Joinery Limited
Sowerby Works, Bramley, Leeds LS13 2QN

Dear Sirs,

Re: Divorce and financial arrangements

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your divorce and the financial arrangements arising
from it. Our work includes preparing and issuing the divorce application, corresponding with
the court and with your spouse''s solicitors, advising you on the disclosure of financial
information, and advising on any proposal for settlement.

Our work does not include arrangements for children, which would be a separate matter, nor
does it include representation at a final hearing, for which we would instruct counsel and
write to you separately about the costs.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £215 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £1,720 plus VAT. In addition you
should allow approximately £340 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

The timing of a divorce is largely governed by the court timetable and by the statutory
periods, which currently mean a minimum of around 6 months.

Who will act for you

This matter will be handled by Priya Raval, Associate, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Priya Raval
Associate
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/111', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/111
22 March 2026

Ms Yvonne Baptiste
14 Chapel Allerton Rise, Leeds LS7 4NF

Dear Ms Baptiste,

Re: Estate of Mr George Ainsworth deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr George Ainsworth, who died on
17 June 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £340 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £2,720 plus VAT. In addition you
should allow approximately £250 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 6 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Tom Harrow, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Tom Harrow
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/112', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/112
11 April 2026

Mr Peter Lindqvist
40 Weetwood Lane, Leeds LS16 5NR

Dear Mr Lindqvist,

Re: Estate of Mr George Ainsworth deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr George Ainsworth, who died on
28 May 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £190 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 10 hours, giving an estimate of £1,900 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 18 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Aisha Bello, Solicitor, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Aisha Bello
Solicitor
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/113', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/113
15 June 2026

Mrs Susan Ainsworth
6 Church Wood Mount, Leeds LS16 5AR

Dear Mrs Ainsworth,

Re: Settlement agreement

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with the settlement agreement offered to you by your
employer. Our work includes reviewing the agreement, advising you on its terms and effect
and in particular on the claims you would be giving up, discussing with you whether the
financial terms are reasonable, and signing the adviser''s certificate required for the
agreement to be binding.

Our work does not include negotiating the financial terms with your employer unless you
instruct us separately to do so, nor does it include bringing any claim in the Employment
Tribunal.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £190 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 10 hours, giving an estimate of £1,900 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Advice of this kind is usually completed within 8 weeks of receiving the draft agreement.

Who will act for you

This matter will be handled by Aisha Bello, Solicitor, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Aisha Bello
Solicitor
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/114', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/114
30 June 2026

Mrs Elaine Whitcombe
4 Priory Gardens, Leeds LS8 2QT

Dear Mrs Whitcombe,

Re: Estate of Mr George Ainsworth deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr George Ainsworth, who died on
24 August 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £265 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 18 hours, giving an estimate of £4,770 plus VAT. In addition you
should allow approximately £250 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 18 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Daniel Okoye, Senior Associate, who will be your day to day
contact. The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Daniel Okoye
Senior Associate
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/115', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/115
12 March 2026

Mr Raymond Osei
112 Cardigan Lane, Leeds LS4 2LE

Dear Mr Osei,

Re: Settlement agreement

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with the settlement agreement offered to you by your
employer. Our work includes reviewing the agreement, advising you on its terms and effect
and in particular on the claims you would be giving up, discussing with you whether the
financial terms are reasonable, and signing the adviser''s certificate required for the
agreement to be binding.

Our work does not include negotiating the financial terms with your employer unless you
instruct us separately to do so, nor does it include bringing any claim in the Employment
Tribunal.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £320 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 12 hours, giving an estimate of £3,840 plus VAT. In addition you
should allow approximately £620 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Advice of this kind is usually completed within 8 weeks of receiving the draft agreement.

Who will act for you

This matter will be handled by Sarah Fenn, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Sarah Fenn
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/116', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/116
23 January 2026

Northgate Property Holdings Limited
Unit 7, Kirkstall Business Park, Leeds LS5 3BF

Dear Sirs,

Re: Divorce and financial arrangements

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your divorce and the financial arrangements arising
from it. Our work includes preparing and issuing the divorce application, corresponding with
the court and with your spouse''s solicitors, advising you on the disclosure of financial
information, and advising on any proposal for settlement.

Our work does not include arrangements for children, which would be a separate matter, nor
does it include representation at a final hearing, for which we would instruct counsel and
write to you separately about the costs.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £340 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £5,100 plus VAT. In addition you
should allow approximately £950 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

The timing of a divorce is largely governed by the court timetable and by the statutory
periods, which currently mean a minimum of around 9 months.

Who will act for you

This matter will be handled by Tom Harrow, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Tom Harrow
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/117', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/117
10 January 2026

Ms Priya Raval
31 Cranmer Bank, Leeds LS17 5DA

Dear Ms Raval,

Re: Divorce and financial arrangements

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in connection with your divorce and the financial arrangements arising
from it. Our work includes preparing and issuing the divorce application, corresponding with
the court and with your spouse''s solicitors, advising you on the disclosure of financial
information, and advising on any proposal for settlement.

Our work does not include arrangements for children, which would be a separate matter, nor
does it include representation at a final hearing, for which we would instruct counsel and
write to you separately about the costs.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £190 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 15 hours, giving an estimate of £2,850 plus VAT. In addition you
should allow approximately £620 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

The timing of a divorce is largely governed by the court timetable and by the statutory
periods, which currently mean a minimum of around 12 months.

Who will act for you

This matter will be handled by Aisha Bello, Solicitor, who will be your day to day contact.
The partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Aisha Bello
Solicitor
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/118', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/118
21 May 2026

Mr and Mrs J Alderton
8 Wentworth Crescent, Harrogate HG2 9QT

Dear Mr Alderton,

Re: Estate of Mr Ronald Baptiste deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr Ronald Baptiste, who died on
28 May 2025. Our work includes identifying and valuing the assets and liabilities of the
estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £320 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £2,560 plus VAT. In addition you
should allow approximately £480 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 9 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Sarah Fenn, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Sarah Fenn.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Sarah Fenn
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

INSERT INTO precedents (firm_id, doc_type, section_key, body)
SELECT id, 'engagement_letter', 'corpus:HF/2026/119', 'Private and confidential

Harrow & Fenn Solicitors
18 Bishopsgate Row, Leeds LS1 4TQ

Our reference: HF/2026/119
10 February 2026

Dr Miriam Cole
56 Hyde Park Road, Leeds LS6 1AL

Dear Dr Cole,

Re: Estate of Mr George Ainsworth deceased

Thank you for instructing Harrow & Fenn Solicitors. This letter sets out the terms on which
we will act for you, the scope of the work we have agreed to carry out, and the basis on
which we will charge for it. Please read it carefully and keep it with your papers. If
anything in it does not match your understanding of what we discussed, please tell us before
we begin work.

Scope of our work

We will act for you in the administration of the estate of Mr George Ainsworth, who died on
06 February 2025. Our work includes identifying and valuing the assets and liabilities of
the estate, preparing the application for a grant of probate, submitting the relevant
inheritance tax account, collecting in the assets once the grant is issued, settling
liabilities, and preparing estate accounts for your approval before distribution.

Our work does not include advice on the personal tax position of individual beneficiaries,
the sale of any property forming part of the estate, which would be a separate matter, or
any contentious claim brought against the estate.

Our charges

Our charges for this matter will be calculated on an hourly basis at a rate of £340 per
hour, exclusive of VAT. On the basis of what you have told us, we estimate that this matter
will take in the region of 8 hours, giving an estimate of £2,720 plus VAT. In addition you
should allow approximately £620 for disbursements, which are payments we make on your behalf
to third parties.

We will not exceed the estimate set out above without first discussing it with you and
obtaining your written authority to continue. If it becomes clear at any stage that the work
will cost materially more than we have estimated, we will write to you with a revised figure
and the reasons for it before incurring further charges.

Timescales

Estates of this nature are typically concluded within 6 months, although the timing of the
grant is outside our control.

Who will act for you

This matter will be handled by Tom Harrow, Partner, who will be your day to day contact. The
partner with overall supervision of this matter is Tom Harrow.

Your responsibilities

So that we can act effectively for you, we ask that you provide us with clear instructions
and with all documents and information relevant to this matter, that you tell us promptly of
any change in your circumstances or contact details, and that you inform us without delay if
your instructions change or if you receive any communication from another party about this
matter.

Data protection

We will process your personal data in accordance with applicable data protection law and
with our privacy notice, a copy of which is available on request. We will retain your file
for six years following the conclusion of this matter, after which it may be destroyed
without further notice to you.

If something goes wrong

We are committed to providing a high standard of service. If you are unhappy with any aspect
of the service you receive, or with a bill, please raise it in the first instance with the
supervising partner named in this letter, who will investigate and respond to you in
writing. If we are unable to resolve your complaint, you may be entitled to refer it to the
Legal Ombudsman. Harrow & Fenn Solicitors is authorised and regulated by the Solicitors
Regulation Authority.

Our standard terms of business apply to this engagement and are enclosed with this letter.
Where anything in this letter conflicts with those terms, this letter takes precedence.

Please sign and return the enclosed copy of this letter to confirm your agreement to these
terms so that we may begin work.

Yours sincerely,

Tom Harrow
Partner
Harrow & Fenn Solicitors'
FROM firms WHERE slug = 'harrow-fenn';

SELECT count(*) AS letters_loaded FROM precedents WHERE section_key LIKE 'corpus:%';