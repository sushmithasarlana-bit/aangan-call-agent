# Eval: September 2026 phone enquiries

Run 2026-10-10 17:10 UTC against `https://aangan-call-agent-pi.vercel.app` · model `gemini-3.8-flash` · **10/10 correct** · price figures in output: **0**

A case passes when the classification matches, the deciding criterion matches (for not_fit), `asked_pricing` matches where expected, and no output line carries a price the caller didn't say. Transcripts are the case-pack originals with the human "Note:" annotations removed.

| Call | Scenario | Expected | Got | Deciding criterion | Asked price | Reason given | Result |
|---|---|---|---|---|---|---|---|
| T01 | 3BHK Kothrud, owner, done by March | qualified | qualified | none | no | Passes all five criteria: complete 3BHK redesign in Kothrud with a realistic timeline through March. | ✅ |
| T02 | 2BHK Wakad, asks the price twice | qualified, asked_pricing | qualified | none | yes | Passes all five criteria; full 2BHK redesign in Wakad with realistic timeline. | ✅ |
| T03 | Nashik | not_fit (service_area) | not_fit | service_area | no | Fails criterion 2 (service area): the property is in Nashik. | ✅ |
| T04 | Ideas and advice only | not_fit (real_project) | not_fit | real_project | no | Fails criterion 1 (real project): caller seeks design ideas and colour advice only, without execution. | ✅ |
| T07 | Before Diwali, 3 weeks away | not_fit (timeline) | not_fit | timeline | no | Fails criterion 3 (timeline): required completion before Diwali is in approximately three weeks, which is well under the minimum six-week requirement. | ✅ |
| T09 | Existing client, angry | complaint | complaint | complaint | no | Existing client with an urgent complaint regarding lack of communication on an active project. | ✅ |
| T10 | 1BHK Kharadi, ₹1–1.5 lakh volunteered | not_fit (budget) | not_fit | budget | no | Fails criterion 4 (budget): volunteered budget of 1 to 1.5 lakh maximum is clearly below execution cost for a kitchen and bedroom. | ✅ |
| T11 | Rented 2BHK Baner, no structural work | qualified | qualified | none | no | Passes all five criteria; rented 2BHK in Baner with execution across three rooms and landlord approval for non-structural work. | ✅ |
| T14 | Son calling for parents, Hadapsar (decision-maker note) | qualified | qualified | none | no | Passes all five criteria; decision-makers are the caller's parents, who will attend the consultation. | ✅ |
| T19 | Restaurant | not_fit (out_of_scope) | not_fit | out_of_scope | no | Fails criterion out_of_scope: restaurants and hospitality projects are outside studio scope. | ✅ |

## Handoff notes

**T01** (qualified)

```
Who: Priya, phone not captured in transcript, referred by Shruti Joshi
Property: 3BHK apartment, 1,400 sq ft carpet, Dahanukar Colony, Kothrud
Scope: Full redesign and execution for kitchen, living room, and bedrooms
Timeline: Site available, completion desired by March
Decision-maker: Priya and husband, both aligned
Budget: Not discussed
Pricing: Did not ask; for the designer to establish at consultation
Watch-outs and next step: Strong referral lead; call back to book initial consultation slot
```

**T02** (qualified)

```
Who: Caller name not given, phone not given, found via Instagram
Property: 2BHK, 950 sq ft, Wakad
Scope: Full redesign — modular kitchen, wardrobes, living room, both bedrooms
Timeline: Start design in October, move in November
Decision-maker: Caller
Budget: Not discussed
Pricing: Asked for ballpark and range; deferred to designer at consultation
Watch-outs and next step: Agreed to consultation; need to confirm slot and contact details
```

**T03** (not_fit)

```
1. Who: Suresh Patil, phone not given, found on LinkedIn
2. Property: Home, size not given, Nashik
3. Scope: Redo home office and study
4. Timeline: Not discussed
5. Decision-maker: Suresh Patil (caller)
6. Budget: Not discussed
7. Pricing: Not asked; for designer at consultation
8. Watch-outs and next step: Closed; property is in Nashik, outside Pune and PCMC service area
```

**T04** (not_fit)

```
1. Who: Not provided, phone not provided, referral source not provided
2. Property: Home (living room), size not provided, locality not provided
3. Scope: Ideas and suggestions on colours and furniture arrangement only
4. Timeline: Possession not provided, start not provided, finish not provided
5. Decision-maker: Unclear
6. Budget: Not discussed
7. Pricing: Caller did not ask; pricing is for designer at consultation
8. Watch-outs and next step: Closed gracefully; enquiry is for advice/ideas only without execution
```

**T07** (not_fit)

```
Who: Name and contact details not provided; referral source unknown
Property: Home, size and locality not mentioned
Scope: Redesign of living room and kitchen
Timeline: Wanted completion before Diwali (in ~3 weeks)
Decision-maker: Not identified
Budget: Not discussed
Pricing: Not asked; for designer at consultation
Watch-outs and next step: Closed as timeline is under 6 weeks; caller mused about post-Diwali but did not commit
```

**T09** (complaint)

```
Who: Sheetal Deshpande, phone not provided, existing client
Property: 2BHK flat, Viman Nagar
Scope: Ongoing interior project assigned to Aryan
Timeline: In progress for 3 months
Decision-maker: Sheetal Deshpande
Budget: Not discussed
Pricing: Did not ask about pricing
Watch-outs and next step: Urgent complaint: designer unresponsive for 5 days; callback promised within 15 minutes from Nikhil or senior lead
```

**T10** (not_fit)

```
1. Who: Name not provided, phone not provided, referral source unknown
2. Property: 1BHK, 550 sq ft, Kharadi
3. Scope: Kitchen and one bedroom redesign with execution
4. Timeline: Not discussed
5. Decision-maker: Caller
6. Budget: Caller volunteered: 1 to 1.5 lakh maximum for everything
7. Pricing: Did not ask; pricing is for designer at consultation
8. Watch-outs and next step: Closed as not a fit; volunteered budget is too low for kitchen and bedroom execution
```

**T11** (qualified)

```
1. Who: Name not provided, phone not provided, referral source not mentioned
2. Property: Rented 2BHK apartment, Baner
3. Scope: Living room, bedroom, and kitchen design and reversible fittings
4. Timeline: Living there currently (3-year lease), start and finish dates not discussed
5. Decision-maker: Caller (confirmed landlord approval for non-structural work)
6. Budget: Not discussed
7. Pricing: Not asked, to be discussed by designer at consultation
8. Watch-outs and next step: Call back to collect contact details and schedule consultation slot
```

**T14** (qualified)

```
1. Who: Caller inquiring for parents, phone shared on call, source not mentioned
2. Property: 3BHK in Hadapsar, new possession
3. Scope: Complete interior design
4. Timeline: New possession, start and finish dates to be established
5. Decision-maker: Parents (caller confirmed they will attend consultation)
6. Budget: Not discussed
7. Pricing: Caller did not ask; to be handled by designer at consultation
8. Watch-outs and next step: Call back to coordinate directly with parents and schedule consultation
```

**T19** (not_fit)

```
1. Who: Name not provided, phone not given, saw studio work
2. Property: Restaurant, size not given, Koregaon Park
3. Scope: Full restaurant interior design
4. Timeline: Not discussed
5. Decision-maker: Caller
6. Budget: Not discussed
7. Pricing: Caller did not ask about pricing
8. Watch-outs and next step: Closed; hospitality and restaurant projects are outside our scope
```
