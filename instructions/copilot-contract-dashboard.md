# Copilot Instructions — Engaging UX Design Dashboard: Contract Module Extension

## Context

You are extending an existing admin dashboard for **Engaging UX Design**, a freelance UX design and web development practice based in Eindhoven, Netherlands. The dashboard is built in **pure HTML, CSS, and JavaScript** — no frameworks, no build tools. It is hosted on **Hostinger** and deployed manually. Do not introduce any npm packages, bundlers, or external dependencies unless explicitly instructed.

The existing dashboard already has a working **Invoice module** (New Invoice + Invoice History). You are adding a full **Contract module** alongside it without breaking anything that already exists.

---

## 1. Brand & Design System

Apply these values consistently throughout all new HTML and CSS. Never override existing brand styles.

### Fonts
Load via Google Fonts if not already present in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;700;900&family=Gabarito:wght@400;600&display=swap" rel="stylesheet">
```
- **Headings / logo / page titles / stat values:** `Alexandria`, weight `900`
- **All body copy, labels, inputs, buttons:** `Gabarito`, weight `400` or `600`

### CSS Variables
Add these to `:root` if not already present. Do not remove or override existing variables.

```css
:root {
  --brand-dark:   #1c1008;
  --brand-brown:  #3b2110;
  --brand-rust:   #8b3a1e;
  --brand-cream:  #f7ede2;
  --brand-cream2: #f0e4d8;
  --brand-mid:    #5c3a28;
  --brand-rust-light: #b85c3a;
  --brand-rust-muted: #c4714f;
}
```

### Color Usage Rules
| Element | Value |
|---|---|
| Page background | `var(--brand-cream)` |
| Sidebar background | `var(--brand-dark)` |
| Active nav item background | `var(--brand-brown)` |
| Active nav item left border | `var(--brand-rust)` |
| Primary button background | `var(--brand-dark)` |
| CTA / accent color | `var(--brand-rust)` |
| Card background | `#ffffff` |
| Card border | `1px solid #d4bfb0` |
| Table row hover | `#fdf5ef` |
| Muted text | `#9a7a65` |
| Section divider | `#ecddd4` |

### Border Radius
- Cards, section containers: `10px`
- Buttons, inputs: `7px`
- Badges / pills: `20px`
- Round buttons (top-right CTA): `20px`

---

## 2. Existing Dashboard Structure

The dashboard is a two-column layout:

```
[ Sidebar 200px fixed ] [ Main content area flex-grow ]
```

The full page height is set (e.g. `height: 100vh` or `min-height: 100vh`). Do not change this layout.

### Sidebar Structure (existing + additions)

The sidebar contains the following sections in order. **Do not remove or reorder existing items.** Add the new Contract section after the existing Invoicing section.

```
SIDEBAR
├── Logo block
│   ├── "engaging designUX" (Alexandria 900, two lines)
│   └── "ADMIN DASHBOARD" (small caps label)
│
├── Meta bar
│   ├── Refresh icon button  ← DO NOT REMOVE
│   ├── Grid icon button     ← DO NOT REMOVE
│   └── Date / Week display
│
├── Nav: INVOICING
│   ├── New Invoice
│   └── Invoice History  (was active by default)
│
├── Nav: CONTRACTS  ← ADD THIS ENTIRE SECTION
│   ├── New Contract
│   ├── Contract History
│   └── Clients
│
└── User block (bottom)
    ├── Avatar circle "N"
    ├── "Admin"
    └── "engaginguxdesign.com"
```

#### Sidebar icon buttons (meta bar)
These two icon buttons sit above the date display in the sidebar. They already exist — do not remove them. Ensure they remain rendered after your changes:

```html
<div class="sidebar-meta">
  <div class="sidebar-meta-icons">
    <div class="meta-icon" title="Refresh">↺</div>
    <div class="meta-icon" title="Overview">⊞</div>
  </div>
  <div class="sidebar-date">
    DATE <strong>25, April 2026</strong><br>WK <strong>17</strong>
  </div>
</div>
```

Style each `.meta-icon` as:
```css
.meta-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #2e1c0e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--brand-mid);
  font-size: 11px;
}
.meta-icon:hover {
  background: #2e1c0e;
  color: var(--brand-cream2);
}
```

#### Nav item styles
```css
.nav-section-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--brand-mid);
  padding: 8px 18px 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 18px;
  font-size: 12px;
  color: #8a6a55;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}
.nav-item:hover {
  color: var(--brand-cream2);
  background: #2a1608;
}
.nav-item.active {
  color: var(--brand-cream);
  background: var(--brand-brown);
  border-left-color: var(--brand-rust);
}
```

Each nav item has a small inline SVG icon (13×13px, `stroke="currentColor"`). Icons per item:
- **New Invoice:** document with lines
- **Invoice History:** document with grid lines
- **New Contract:** document with a plus sign
- **Contract History:** document outline
- **Clients:** person silhouette

---

## 3. Main Content Area

### Topbar
```html
<div class="topbar">
  <div class="page-title" id="page-title">Invoice History</div>
  <button class="btn-primary" id="top-btn" onclick="topBtnAction()">
    <span style="font-size:14px">+</span>
    <span id="top-btn-label">New Invoice</span>
  </button>
</div>
```

The page title and top button label update dynamically via JS when the user navigates. See Section 6 for the JS mapping.

```css
.btn-primary {
  background: var(--brand-dark);
  color: var(--brand-cream);
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-family: 'Gabarito', sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-primary:hover { background: var(--brand-brown); }
```

---

## 4. Views

Each view is a `<div class="view" id="view-{name}">`. Only one is visible at a time (`.view.active { display: block; }`, others `display: none`).

### Existing views (do not modify content)
- `view-invoices` — Invoice History with stat cards and table
- `view-new-invoice` — existing invoice form

### New views to add

#### `view-contracts` — Contract History

Stat grid (4 cards):
| Label | Value |
|---|---|
| Active contracts | 3 |
| Awaiting signature | 1 (orange) |
| Signed this month | 2 (green) |
| Next contract no. | 2026-8832104-0003 (with badge "Auto-generated") |

Table columns: `CONTRACT ID · CLIENT · TYPE · PHASE · VALUE · STATUS · ACTIONS`

Sample rows:
```
2026-8832104-0001 | Joey de Laat | Business Website | Phase 1 (purple badge) | €2,499 | Signed (green) | View / Invoice
2026-8832104-0002 | Joey de Laat | Business Website | Phase 2 (blue badge)   | €2,499 | Awaiting sig. (amber) | View / Resend
2026-5541290-0001 | Marco Visser | Custom Agreement | Special (rust badge)   | €120   | Signed (green) | View / Invoice
```

Phase badges use colored pills:
```css
.badge-phase1 { background: #ede9fe; color: #5c3aaa; }
.badge-phase2 { background: #e8f0fe; color: #1a56a0; }
.badge-phase3 { background: #e6f4ea; color: #2d6e2d; }
.badge-custom { background: #fce8e0; color: #8b3a1e; }
.badge-signed { background: #e6f4ea; color: #2d6e2d; }
.badge-pending { background: #fff8e1; color: #8a5f00; }
```

Contract ID uses monospace font, muted color. Client name is a link that navigates to the Clients view.

---

#### `view-clients` — Clients

A list of client cards. Each card:
```
[ Avatar circle (initials, rust bg) ] [ Client name (bold) | Type | Email ] [ "N contracts · N invoices" (rust) ]
```

Sample clients:
- **Joey de Laat** — Business Website · joey@example.com — 2 contracts · 1 invoice
- **Marco Visser** — Custom Agreement · marco@photographer.nl — 1 contract · special pricing

```css
.client-card {
  border: 1px solid #d4bfb0;
  border-radius: 9px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}
.client-card:hover { border-color: var(--brand-rust-muted); background: #fdf5ef; }
.client-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--brand-rust);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Alexandria', sans-serif; font-weight: 900; font-size: 13px; color: var(--brand-cream);
  flex-shrink: 0;
}
```

---

#### `view-new-contract` — Contract Creation Wizard

This is the main new feature. It is a **7-step wizard** with a sticky left-side step tracker and a right-side form panel.

```html
<div class="wizard-wrap">
  <!-- Left: step tracker (200px) -->
  <div class="wizard-steps"> ... </div>
  <!-- Right: form panels -->
  <div class="wizard-form"> ... </div>
</div>
```

```css
.wizard-wrap {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 16px;
  align-items: start;
}
.wizard-steps {
  background: #fff;
  border: 1px solid #d4bfb0;
  border-radius: 10px;
  padding: 14px 0;
  position: sticky;
  top: 0;
}
.wizard-form {
  background: #fff;
  border: 1px solid #d4bfb0;
  border-radius: 10px;
  padding: 20px 22px;
}
```

##### Step tracker items

Each step item has a number circle, a label, and a sub-label. States:
- **Default:** cream circle, muted text
- **Active:** rust circle (`var(--brand-rust)`), dark text
- **Done:** green circle (`#2d6e2d`), muted text, number replaced with `✓`

Seven steps:
| # | Label | Sub-label |
|---|---|---|
| 1 | Client details | Who is this for? |
| 2 | Contract type | Plan & phase |
| 3 | Project details | Scope & timeline |
| 4 | Pricing | Payments & fees |
| 5 | Revisions | Scope & tiers |
| 6 | Add-ons | Extras & hosting |
| 7 | Generate | Preview & send |

A thin `#ecddd4` divider line sits between each step item.

##### Progress bar
Sits at the top of the form panel. 3px high, rust fill, animates width on step change.
```
Step: 1   2   3   4   5   6   7
Width: 14% 28% 42% 56% 70% 84% 100%
```

---

## 5. Wizard — Step-by-Step Specification

### Step 1 — Client details

A standard 2-column form grid with fields: Full name, Company (optional), Email, Phone, KvK (optional), City.

**Client lookup logic:** When the user types in the "Full name" field, check the value against a known clients array (defined in JS). If a match is found, display a green-tinted info card above the form showing:
- Avatar initials, client name, email, project type
- Phase pills: each phase listed as "Phase 1 — signed" (green), "Phase 2 — active" (amber with border), "Phase 3 — upcoming" (muted cream)
- A note: "Client is currently in Phase X. Next contract will be Phase Y."

If no match, hide this card.

---

### Step 2 — Contract type

**Four type cards** in a 2×2 grid:
- Standard project — Full project across all 3 phases. Requires plan selection.
- Phase contract — A single phase for an existing client.
- Scope extension — Add-on or new feature for an active project.
- Custom agreement — Special pricing, friend rate or non-standard terms.

Only one card can be selected at a time. Selected card gets `border-color: var(--brand-rust); background: #fdf0e8`.

**Plan / tier section** (shown for all types except Custom agreement):

Three plan cards in a 3-column grid:
| Plan | Price | Description |
|---|---|---|
| Basic | from €799 | 5 pages, static, no apps |
| Business | from €2,499 | 8 pages, dynamic, 1 app |
| Enterprise | from €4,999 | Custom scope, multi-app |

One plan can be selected. Default: Business.

**If Custom agreement is selected:** hide the plan section and show an amber warning note: _"Custom agreement: all pricing will start at €0. You fill in the exact amounts in Step 4. No plan tier required."_

**Phase dropdown** (always visible):
```
Phase 1 — Strategy & Structure
Phase 2 — Design & Prototype
Phase 3 — Build & Launch
Custom phase
```

**Phase note** (shown below the dropdowns, driven by phase + contract type):
- Phase 1 or Standard project selected → info note: _"Phase 1 contract: Tier 2 structural revision is not available. Structural changes can only be requested before proceeding to Phase 2. It is the client's responsibility to raise all change requests at Phase 1 sign-off."_
- Phase 2 → info note: _"Phase 2 contract: Tier 2 structural changes are now available if scoped here."_
- Phase 3 → info note: _"Phase 3 is the final build and launch phase. Structural changes at this stage are charged at a premium rate."_

**Language dropdown:**
```
Bilingual (EN + NL)
English only
Dutch only
```

---

### Step 3 — Project details

2-column grid:
- Project name (text input)
- Contract ID (read-only, auto-generated, format: `2026-[clientcode]-[phasenumber]`, e.g. `2026-8832104-0003`)
- Deliverables (full-width textarea, 3 rows)
- Phase start date (date input)
- Estimated completion (date input)

---

### Step 4 — Pricing & payments

**Pre-fill logic based on plan chosen in Step 2:**
```javascript
const PLANS = {
  basic:      { price: 799,  initFee: 100 },
  business:   { price: 2499, initFee: 100 },
  enterprise: { price: 4999, initFee: 100 },
  custom:     { price: 0,    initFee: 0   }
};
```
On entering this step, set the "Total project value" and "Project initiation fee" fields to the plan values. If Custom agreement, set both to empty/0 and show an info note: _"Custom agreement detected. Fill in the total value above and the breakdown will calculate automatically below."_

**Live breakdown panel** (recalculates on every keystroke in either field):
```
Phase 1 (30%) — before work starts         → total × 0.30
Initiation fee deducted                    → − initFee
Phase 2 (40%) — after Phase 2 approval     → total × 0.40
Phase 3 (30%) — before publishing          → total × 0.30
Total                                      → total
```
All values formatted as `€X,XXX.XX`. Show `—` if inputs are empty. Last row is bold.

---

### Step 5 — Revision scope

Three revision tier blocks displayed as bordered cards:

**Tier 1 — Cosmetic changes** (always shown, always "Included"):
- Badge: green "Always included"
- Description: Color, font, spacing, copy tweaks. Unlimited rounds within each phase. No extra charge ever.

**Tier 2 — Structural changes** (conditional):
- If phase is Phase 1 OR contract type is Standard project:
  - Badge: muted `#f0e4d8` background, muted text: "Not available in Phase 1"
  - Description: _"Structural changes are not applicable in Phase 1. The client must raise all change requests at Phase 1 sign-off before Phase 2 begins. It is the client's responsibility."_
  - Hide the hourly rate input
- If phase is Phase 2 or Phase 3:
  - Badge: amber "Charged at hourly rate"
  - Description: Layout restructure, new sections, navigation changes. Scoped per request.
  - Show an editable rate input pre-filled based on plan:
    ```
    Basic: €50/hour
    Business: €75/hour
    Enterprise: €95/hour
    Custom: €75/hour (default)
    ```
  - Show info note: _"Advised rate for the [Plan] plan: €X/hr. Adjust if needed."_

**Tier 3 — New features** (always shown, always "Quoted separately"):
- Badge: rust "Quoted separately"
- Description: Sign-up flows, booking apps, payments, user data. Requires a separate addendum. Third-party costs (Supabase, Vercel) passed through at cost.
- Below description: a 3-column grid showing indicative rates per plan:
  ```
  Basic: €50/hr  |  Business: €75/hr  |  Enterprise: €95/hr
  ```
  The currently selected plan's card is highlighted with a rust border and light cream background.
- Footer note: _"Active plan is highlighted. Supabase & Vercel costs are always passed through at cost on top of the hourly rate."_

---

### Step 6 — Add-ons & hosting

#### Hosting & domain section

Three option cards in a 3-column grid. Only one selectable at a time:

| Option | Description | Price |
|---|---|---|
| Domain + Hosting | You provide both via Hostinger | ~€12/yr + ~€36/yr |
| Hosting only | Client has their own domain | ~€36/yr |
| Neither | Client manages own hosting | €0 |

Below the grid, show a dynamic info note:
- Domain + Hosting selected: _"Domain (~€12/yr) + Hostinger hosting (~€36/yr). Both passed through at cost, charged annually to client."_
- Hosting only: _"Hostinger hosting (~€36/yr) passed through at cost. Client provides their own domain."_
- Neither: _"Client manages their own domain and hosting. No pass-through costs."_

#### Service add-ons section

A list of toggle rows. Each row: name on the left, price below name, toggle switch on the right.

Add-on prices vary by plan:
```javascript
const ADDON_PRICES = {
  basic:      { seo: 300, logo: 150, support: 200 },
  business:   { seo: 500, logo: 200, support: 350 },
  enterprise: { seo: 800, logo: 350, support: 600 },
  custom:     { seo: 500, logo: 200, support: 350 }  // default to business
};
```

Add-on rows:
| Name | Price key | Default |
|---|---|---|
| Foundational SEO setup | `seo` (one-off) | Off |
| Logo design / creation | `logo` (one-off) | Off |
| Priority support | `support` + `/mo` | Off |
| Supabase (user data / auth) | Pass-through at cost | On |
| Vercel (hosting / serverless) | Pass-through at cost | Off |

Toggle style:
```css
.tog { width: 30px; height: 17px; border-radius: 9px; background: #d4bfb0; position: relative; cursor: pointer; transition: background .2s; }
.tog.on { background: var(--brand-rust); }
.tog::after { content: ''; position: absolute; width: 12px; height: 12px; background: white; border-radius: 50%; top: 2.5px; left: 2.5px; transition: left .2s; }
.tog.on::after { left: 15.5px; }
```
Clicking a toggle calls `this.classList.toggle('on')`.

---

### Step 7 — Generate (preview & send)

#### Language tabs
Two tab buttons: `English` and `Nederlands`. Default: English. Active tab: `background: var(--brand-dark); color: var(--brand-cream)`.

#### Contract preview pane
A scrollable pane (`max-height: 340px; overflow-y: auto`) with `background: var(--brand-cream)`, showing a pre-drafted contract. Two versions exist (EN and NL); toggle which is shown based on active tab.

Contract preview structure:
```
[Project name] — [Phase]
Contract ID: [id] · Issued: [today's date]

PARTIES
Service Provider: Engaging UX Design, Eindhoven, Netherlands · info@engaginguxdesign.com
Client: [client name] · [client email]

SCOPE OF WORK
[deliverables summary from Step 3]

PAYMENT
[phase payment amount] ([%] of total [total] excl. VAT). Due [milestone condition].

REVISION SCOPE
Cosmetic changes included. Structural changes at €[rate]/hr (Phase 2+ only). New features via addendum. Third-party costs passed through at cost.

GOVERNING TERMS
Engaging UX Design Service Terms & Project Conditions (engaginguxdesign.com/service-terms-and-conditions). Dutch law applies. Disputes submitted to the competent court in Oost-Brabant.
```

Section headers inside the preview use: `font-weight: 700; font-size: 12px; color: var(--brand-rust); text-transform: uppercase; letter-spacing: 0.06em`.

#### Delivery options
Three equal-width cards below the preview:
| Icon | Label | Sub-label |
|---|---|---|
| ↓ | Download EN | PDF · English version |
| ↓ | Download NL | PDF · Dutch version |
| ✍ | Send for signature | Via Xodo Sign · eIDAS |

Cards have hover state: `border-color: var(--brand-rust); background: #fdf0e8`.

---

## 6. JavaScript — Navigation & State

```javascript
// Known clients (expand as real data is added)
const KNOWN_CLIENTS = [
  {
    name: 'Joey de Laat',
    initials: 'JL',
    email: 'joey@example.com',
    type: 'Business Website',
    phases: [
      { label: 'Phase 1', status: 'signed' },
      { label: 'Phase 2', status: 'active' },
      { label: 'Phase 3', status: 'upcoming' }
    ],
    currentPhase: 2
  },
  {
    name: 'Marco Visser',
    initials: 'MV',
    email: 'marco@photographer.nl',
    type: 'Custom Agreement',
    phases: [{ label: 'Phase 1', status: 'signed' }],
    currentPhase: 1
  }
];

// Page title and top button label per view
const VIEW_META = {
  'invoices':      { title: 'Invoice History',    btn: 'New Invoice' },
  'new-invoice':   { title: 'New Invoice',         btn: 'New Invoice' },
  'contracts':     { title: 'Contract History',   btn: 'New Contract' },
  'new-contract':  { title: 'New Contract',        btn: 'New Contract' },
  'clients':       { title: 'Clients',             btn: 'New Client' }
};

// Top button click — navigate to the relevant "new" view
function topBtnAction() {
  const title = document.getElementById('page-title').textContent;
  if (title.includes('Contract') || title.includes('Client')) {
    switchView('new-contract');
  } else {
    switchView('new-invoice');
  }
}

// View switching
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  const navMap = {
    'invoices':     'nav-invoices',
    'new-invoice':  'nav-invoices',
    'contracts':    'nav-contracts',
    'new-contract': 'nav-new-contract',
    'clients':      'nav-clients'
  };
  if (navMap[view]) document.getElementById(navMap[view]).classList.add('active');
  const meta = VIEW_META[view];
  if (meta) {
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('top-btn-label').textContent = meta.btn;
  }
}
```

### Wizard navigation

```javascript
// Wizard state
let wizardStep = 1;
const STEP_PROGRESS = { 1: 14, 2: 28, 3: 42, 4: 56, 5: 70, 6: 84, 7: 100 };

function nextStep() {
  if (wizardStep < 7) {
    document.getElementById('fs' + wizardStep).classList.remove('active');
    markStepDone(wizardStep);
    wizardStep++;
    document.getElementById('fs' + wizardStep).classList.add('active');
    markStepActive(wizardStep);
    document.getElementById('wizard-progress').style.width = STEP_PROGRESS[wizardStep] + '%';
    // Run step-specific logic on enter
    if (wizardStep === 4) prefillPricing();
    if (wizardStep === 5) renderRevisions();
    if (wizardStep === 6) renderAddons();
    if (wizardStep === 7) document.getElementById('btn-next').textContent = 'Generate contract';
  }
}

function prevStep() {
  if (wizardStep > 1) {
    document.getElementById('fs' + wizardStep).classList.remove('active');
    markStepDefault(wizardStep);
    wizardStep--;
    document.getElementById('fs' + wizardStep).classList.add('active');
    markStepActive(wizardStep);
    document.getElementById('wizard-progress').style.width = STEP_PROGRESS[wizardStep] + '%';
    document.getElementById('btn-next').textContent = 'Continue →';
  }
}
```

### Pricing calculation (Step 4)

```javascript
function calcBreakdown() {
  const total = parseFloat(document.getElementById('total-val').value) || 0;
  const init  = parseFloat(document.getElementById('init-fee').value) || 0;
  const fmt   = v => v > 0 ? '€' + v.toFixed(2) : '—';
  document.getElementById('p1amt').textContent    = fmt(total * 0.30);
  document.getElementById('initamt').textContent  = init ? '− €' + init.toFixed(2) : '—';
  document.getElementById('p2amt').textContent    = fmt(total * 0.40);
  document.getElementById('p3amt').textContent    = fmt(total * 0.30);
  document.getElementById('totalamt').textContent = fmt(total);
}
```

---

## 7. Shared Component Styles

### Stat cards (used in both Invoice and Contract overviews)
```css
.stat-card {
  background: #fff;
  border: 1px solid #d4bfb0;
  border-radius: 10px;
  padding: 16px 18px;
}
.stat-label { font-size: 11px; color: #8a6a55; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.stat-value { font-family: 'Alexandria', sans-serif; font-weight: 900; font-size: 22px; color: var(--brand-dark); }
.stat-value.orange { color: #b85c3a; }
.stat-value.green  { color: #3d7a3d; }
.stat-sub   { font-size: 11px; color: #9a7a65; margin-top: 4px; }
.stat-badge { display: inline-block; font-size: 10px; color: var(--brand-rust); background: #f5d8cc; padding: 2px 8px; border-radius: 10px; margin-top: 5px; }
.stat-grid  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
```

### Section cards (tables, lists)
```css
.section-card { background: #fff; border: 1px solid #d4bfb0; border-radius: 10px; overflow: hidden; margin-bottom: 18px; }
.section-header { padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ecddd4; }
.section-title { font-family: 'Alexandria', sans-serif; font-weight: 700; font-size: 14px; color: var(--brand-dark); }
.section-meta  { font-size: 11px; color: #9a7a65; }
```

### Table styles
```css
table { width: 100%; border-collapse: collapse; }
th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a7a65; padding: 10px 20px; text-align: left; border-bottom: 1px solid #ecddd4; }
td { padding: 12px 20px; font-size: 12px; color: var(--brand-dark); border-bottom: 1px solid #f5ede6; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fdf5ef; }
```

### Action buttons (table rows)
```css
.action-btn { background: none; border: 1px solid #d4bfb0; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; color: var(--brand-dark); margin-right: 4px; font-family: 'Gabarito', sans-serif; }
.action-btn:hover { background: var(--brand-cream2); }
```

### Info / warning notes
```css
.info-note  { background: #fdf0e8; border-left: 3px solid var(--brand-rust); padding: 9px 12px; border-radius: 0 7px 7px 0; font-size: 11px; color: #5c3a28; margin: 10px 0; line-height: 1.5; }
.warn-note  { background: #fff8e1; border-left: 3px solid #e6b800; padding: 9px 12px; border-radius: 0 7px 7px 0; font-size: 11px; color: #6b4a00; margin: 10px 0; line-height: 1.5; }
```

### Form elements
```css
.fi {
  background: var(--brand-cream);
  border: 1px solid #d4bfb0;
  border-radius: 7px;
  padding: 7px 10px;
  font-family: 'Gabarito', sans-serif;
  font-size: 12px;
  color: var(--brand-dark);
  outline: none;
  width: 100%;
}
.fi:focus { border-color: var(--brand-rust); }
select.fi { cursor: pointer; }
```

---

## 8. Files to Modify

| File | Change |
|---|---|
| `index.html` (or equivalent dashboard file) | Add Contract nav items to sidebar, add contract views, add wizard HTML, add contract JS |
| Existing CSS file / `<style>` block | Add all new CSS classes listed above (do not remove existing styles) |
| Existing JS file / `<script>` block | Add `switchView`, `topBtnAction`, wizard navigation, `calcBreakdown`, `renderRevisions`, `renderAddons`, `KNOWN_CLIENTS` array |

**Do not create new files unless instructed.** All additions go into the existing dashboard file(s).

---

## 9. What Not to Change

- Do not remove or restructure the existing Invoice History view
- Do not remove or restructure the existing New Invoice form
- Do not remove the sidebar meta bar icon buttons (refresh / grid)
- Do not change the logo, user block, or brand fonts
- Do not introduce any JavaScript frameworks or npm dependencies
- Do not change the outer dashboard layout (sidebar + main two-column)
- Do not add media queries or mobile breakpoints unless explicitly asked
