# Global Validation Rules — Enterprise-Style Auto-Mapping

## Problem (from your file)

Your Excel has **wrong data in wrong columns**:

| Column header in file | What’s actually in it (example) |
|------------------------|----------------------------------|
| Name                   | Phone numbers (7359355840)       |
| Contact no.            | Emails (siliyas20@gmail.com)     |
| Email                  | "NA" or company name             |
| Company name           | Experience ("7.9Yrs")            |
| Experience             | CTC ("1lpa", "2LPA")             |
| CTC                    | "As per company norms"            |
| Expected CTC           | Notice period ("90 days")        |
| Notice period          | Status ("interested and scheduled") |
| Status                 | Client name                      |
| FLS/Non FLS            | **Actual candidate names**       |

So we **cannot** trust column headers. We must **infer the type of each value** and then map it to the correct field.

---

## How Enterprise Software Does It

1. **Value-first (content-based) detection**  
   For every cell value in the row, run a **global rulebook** that answers: “Is this an email? A phone? A name? Experience? CTC? Notice? Status? Company?”  
   Column name is used only as a **hint or tie-breaker**, not as the source of truth.

2. **Single global rulebook**  
   One set of rules used for **all** values from the file (and any future file). Same rules for “Name” column, “Contact no.” column, or a column named “Remarks” that accidentally has an email.

3. **Conflict resolution**  
   If two values look like “name” (e.g. “Iliyas” and “Mohsin Saiyyad”), pick one using rules: e.g. prefer 2–4 words, no digits; or use column hint. Same for phone/email: take the first or best match per type.

4. **Normalization (auto-fix)**  
   After classification, normalize: phone → 10 digits, email → lowercase, experience → number, notice → days, name → title case.

5. **Validation after mapping**  
   Run validation on the **mapped** record (required fields, format, placeholders) and flag Ready / Review / Blocked.

---

## Global Rules We Apply (by field)

### 1. **Email**
- **Rule:** Matches regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- **Priority:** Only one email per row; first valid match wins.
- **Auto-fix:** Lowercase, trim.

### 2. **Phone**
- **Rule:** After stripping non-digits, exactly 10 digits and starts with 6–9 (Indian mobile).
- **Priority:** First valid match wins. If value is numeric (e.g. 7359355840), treat as phone.
- **Auto-fix:** Strip non-digits, take last 10 digits.

### 3. **Name**
- **Rule:** Alphabetic + spaces, 2–4 words, no digits/special chars; not in placeholder list (NA, TBD, As per company norms, etc.).
- **Priority:** Prefer string that looks like “Full Name”. If multiple, prefer longer or the one from a column name containing “name”/“FLS”.
- **Auto-fix:** Title case, trim.

### 4. **Experience**
- **Rule:** Number (optional decimal) + optional “yrs”/“years”/“YRS”; value between 0–50.
- **Priority:** First valid match.
- **Auto-fix:** Parse to number (e.g. "7.9Yrs" → 7.9).

### 5. **CTC (current salary)**
- **Rule:** Number + “lpa”/“lac”/“lakhs” (or standalone number in salary context); 0–100.
- **Priority:** First value that looks like LPA. “Expected CTC” column hint can prefer expected salary.
- **Auto-fix:** Parse to number; normalize “2LPA” → 2.

### 6. **Expected salary**
- **Rule:** Same as CTC but from “expected”/“desired” context, or second LPA-like value in row.
- **Auto-fix:** Same as CTC.

### 7. **Notice period**
- **Rule:** Number + “days”/“day” or “months”/“month”; 0–180 days equivalent.
- **Auto-fix:** Convert months to days (×30); store as days.

### 8. **Status**
- **Rule:** Keyword match: applied, interested, scheduled, interviewed, rejected, joined, pending, active (or phrase containing these).
- **Auto-fix:** Normalize to one word or standard phrase (e.g. “interested and scheduled” → “interested” or “scheduled”).

### 9. **Location**
- **Rule:** Known city names (e.g. Vadodara, Bangalore, Delhi) or string containing “city”/“location”.
- **Auto-fix:** Trim; optional title case.

### 10. **Position / Job title**
- **Rule:** Keywords: developer, engineer, manager, lead, analyst, SO, FLS, etc.
- **Auto-fix:** Trim.

### 11. **Company / Client**
- **Rule:** Contains org keywords (Pvt, Ltd, LLP, Bank, Solutions, etc.) or long string that isn’t email/phone.
- **Priority:** Two such values → map one to company, one to client.
- **Auto-fix:** Trim.

### 12. **Source of CV**
- **Rule:** Keywords: Naukri, LinkedIn, referral, Indeed, walk-in, portal.
- **Auto-fix:** Trim.

### 13. **SPOC / Feedback**
- **Rule:** Short alphabetic string (often a person name) when company/client/status already filled; or column hint “SPOC”/“Feedback”.

---

## Flow (like enterprise ATS)

```
Excel row (any columns) 
    → Extract all non-empty values
    → For each value: run GLOBAL RULEBOOK → get list of (value, suggestedField)
    → Resolve conflicts (one value per canonical field)
    → Auto-fix / normalize each chosen value
    → Build canonical candidate: { name, phone, email, location, position, experience, ctc, expectedSalary, noticePeriod, company, status, sourceOfCV, client, spoc, … }
    → Validate canonical record → Ready / Review / Blocked
```

No step assumes “column A = name”. Everything is driven by **what the value looks like**.

---

## Applied to `candidates-2026-02-04.xlsx`

- **7359355840** → phone (10 digits, 6–9)
- **siliyas20@gmail.com** → email
- **Iliyas** / **Mohsin Saiyyad** / **Ankit purohit** (from FLS/Non FLS) → name
- **7.9Yrs**, **0.3 YRS**, **10 YRs** → experience
- **1lpa**, **2LPA** → ctc
- **90 days**, **30 Days** → notice period
- **interested and scheduled** → status
- **Utkarsh Small Finance Bank** → client (or company)
- **Vadodara** → location
- **SO** → position
- **Neha**, **Shruti** → spoc
- **As per company norms** → rejected as placeholder for CTC/expected CTC

Result: each row becomes one **correctly mapped** candidate record regardless of which column the data was in.
