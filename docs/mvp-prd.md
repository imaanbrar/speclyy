# MVP Product Document (Short PRD)

## 1) What we’re building (MVP)
A structured workspace for interior designers to:

- **Search a curated product library** (e.g., “Kohler Billet”)
- Add missing products via **URL paste** or **manual entry**
- Organize selections by **project + room**
- Export a **client + trade-ready spec sheet** (**PDF + CSV**)
- Reuse products via **My Library** (personal)

---

## 2) MVP Goal (1 sentence)
Enable a designer to spec a high-end residential project by **searching a trusted library**, filling gaps via **URL/manual capture**, organizing by room, and exporting **PDF + CSV** schedules.

---

## 3) Target user + use case
**Target user**
- Freelance designers + small studios (1–10)
- North America
- High-end residential focus

**Primary use case**
- Kitchen + powder + primary ensuite renovation (or custom home)
- Designer specs **plumbing + paint** and shares **drafts + final** schedules with clients/builders

---

## 4) Inventory coverage (deliberately narrow)
We will not cover everything in MVP. We’ll be “complete within a slice” so search feels trustworthy.

**Launch markets**
- Los Angeles
- New York
- Dallas (Texas)
- Calgary

**Global brands in MVP**
- Plumbing: Delta, Brizo, Kohler
- Paint: Sherwin-Williams, Benjamin Moore

**Local suppliers**
- Curated list per market (seeded manually)

**Fallback**
- If it’s not in the library, designer can add via URL/manual (no blocking).

---

## 5) In-scope (MVP features)

### Projects
- Create project
- Add rooms (Kitchen, Powder, Primary Ensuite, etc.)
- Add items and assign room/category

### Library search + select (must-have)
- Keyword search (e.g., “Kohler Billet”)
- View results (brand, name, image, link)
- Add to project (choose room; finish can be **TBD**)

### Add products (must-have)
- **Paste URL**: save URL + image + editable fields
- **Manual add**: quick entry, editable later

### My Library (must-have)
- Save any item to personal library
- Search My Library and reuse across projects

### Export (must-have)
- Export **CSV + PDF**
- **Draft export** always allowed
- Optional “final-ready” warnings (missing brand/finish/SKU/link etc.) but not blocking

---

## 6) Out of scope (MVP)
- Procurement/ordering/quotes/POs
- Pinterest import, Canva export, AI moodboards
- Collaboration/permissions
- Live pricing/availability
- Deep PDF parsing at scale
- Community marketplace/global editing

---

## 7) Must-win workflows (MVP must nail)
1. Search “Kohler Billet” → select → add to room in seconds  
2. Not found → paste URL or manual add in < 1–2 minutes  
3. Organize by room and see **TBD/missing info** clearly  
4. Export **PDF (clients)** + **CSV (trades)** at any time (draft-friendly)  
5. Save to **My Library** → reuse on next project fast

---

## 8) Global library governance (simple MVP rule)
- **My Library is personal.**
- Global library is **seeded + curated**.
- If a URL is from a **whitelisted supplier/brand domain** and passes strict duplicate checks, it is auto-routed for internal promotion (no user “suggest” flow required).
