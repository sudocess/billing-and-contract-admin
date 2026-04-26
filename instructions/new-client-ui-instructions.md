# Copilot Instructions — Add New Client Page (Desktop + Mobile)

## Overview

This page replaces the old flat "Add new client" form inside the Engaging UX Design admin dashboard. It uses the same sidebar, brand tokens, and font stack as the rest of the dashboard. The form content area is completely redesigned into four grouped card sections with a sticky footer.

The reference file is: `add-new-client.html`

Do not copy this file verbatim. Integrate its HTML structure and CSS into the existing dashboard file where the current client form lives. All CSS classes listed here must be added to the existing stylesheet without removing any existing dashboard classes.

---

## 1. Required fonts

Ensure both fonts are loaded in `<head>`. If already present, do not duplicate.

```html
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;700;900&family=Gabarito:wght@400;500;600&display=swap" rel="stylesheet" />
```

---

## 2. CSS variables

Add to `:root` if not already present. Never remove or rename existing variables.

```css
:root {
  --dark:    #1c1008;
  --brown:   #3b2110;
  --rust:    #8b3a1e;
  --cream:   #f7ede2;
  --cream2:  #f0e4d8;
  --mid:     #5c3a28;
  --muted:   #9a7a65;
  --border:  #d4bfb0;
  --divider: #ecddd4;
  --sb:      200px;
}
```

---

## 3. Page structure

The Add New Client view uses the standard dashboard shell. Only the `.main` content area changes. The sidebar is unchanged.

```
.shell
├── .sb  (sidebar — unchanged, Clients nav item is .active)
└── .main
    ├── .mob-header   (mobile only, hidden on desktop)
    ├── .topbar       (sticky, back button + page title)
    ├── .form-area    (scrollable, contains the four form cards)
    └── .form-footer  (sticky bottom, cancel + add client)
```

---

## 4. Topbar

```html
<div class="topbar">
  <div class="topbar-left">
    <button class="back-btn" onclick="switchView('clients')">← Clients</button>
    <h1 class="page-title">Add new client</h1>
  </div>
</div>
```

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 14px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--cream);
  border-bottom: 1px solid var(--border);
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  padding: 5px 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  font-family: 'Gabarito', sans-serif;
  transition: all .15s;
}
.back-btn:hover { background: var(--cream2); color: var(--dark); }
.page-title {
  font-family: 'Alexandria', sans-serif;
  font-weight: 900;
  font-size: 20px;
  color: var(--dark);
}
```

---

## 5. Form area wrapper

```html
<div class="form-area">
  <!-- four .fc cards go here -->
</div>
```

```css
.form-area {
  flex: 1;
  padding: 24px 28px 100px;
  background: var(--cream2);
}
```

The bottom padding of `100px` ensures the last card is never hidden behind the sticky footer.

---

## 6. Form card component

Every section of the form is a `.fc` card. Each card has a header (`.fc-head`) and a body (`.fc-body`). Do not put fields directly in `.fc-head` — only the icon, title, and description go there.

### Card shell CSS

```css
.fc {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}
.fc-head {
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--divider);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.fc-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--cream2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fc-icon svg {
  width: 16px;
  height: 16px;
  stroke: var(--rust);
  fill: none;
  stroke-width: 1.5;
}
.fc-title {
  font-family: 'Alexandria', sans-serif;
  font-weight: 900;
  font-size: 13px;
  color: var(--dark);
  margin-bottom: 2px;
}
.fc-desc {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
}
.fc-body { padding: 18px 20px; }
```

---

## 7. Form grid and field components

```css
.fg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.fg.cols3 { grid-template-columns: 1fr 1fr 1fr; }
.ff { display: flex; flex-direction: column; gap: 5px; }
.ff.span2 { grid-column: 1 / -1; }

.fl {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.opt {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .04em;
  color: #c4b0a5;
  background: var(--cream2);
  padding: 1px 7px;
  border-radius: 10px;
  text-transform: uppercase;
}
.fi {
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 12px;
  font-family: 'Gabarito', sans-serif;
  font-size: 12px;
  color: var(--dark);
  outline: none;
  width: 100%;
  transition: border-color .15s, background .15s;
}
.fi:focus { border-color: var(--rust); background: #fff; }
.fi::placeholder { color: #c4b0a5; }
select.fi { cursor: pointer; }
.hint {
  font-size: 10px;
  color: #b8a090;
  line-height: 1.5;
  margin-top: 2px;
}
```

**Rules:**
- Use `.opt` pill only on truly optional fields. Required fields have no badge at all.
- Never use all-caps free text for labels — the `.fl` class handles uppercase automatically via `text-transform`.
- Use `.hint` for helper text below a field. Keep hints to one line maximum.

---

## 8. The four form cards — exact HTML

### Card 1 — Contact

```html
<div class="fc">
  <div class="fc-head">
    <div class="fc-icon">
      <svg viewBox="0 0 16 16" fill="none" stroke-width="1.5">
        <circle cx="8" cy="5" r="2.5"/>
        <path d="M3 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/>
      </svg>
    </div>
    <div>
      <div class="fc-title">Contact</div>
      <div class="fc-desc">Primary details used on invoices and in the client party block on contracts.</div>
    </div>
  </div>
  <div class="fc-body">
    <div class="fg">
      <div class="ff">
        <label class="fl">First name</label>
        <input class="fi" name="first_name" placeholder="Joey" />
      </div>
      <div class="ff">
        <label class="fl">Last name</label>
        <input class="fi" name="last_name" placeholder="de Laat" />
      </div>
      <div class="ff">
        <label class="fl">Company <span class="opt">optional</span></label>
        <input class="fi" name="company" placeholder="LHR Photography" />
      </div>
      <div class="ff">
        <label class="fl">Phone</label>
        <input class="fi" type="tel" name="phone" placeholder="+31 6 12 34 56 78" />
      </div>
      <div class="ff span2">
        <label class="fl">Email</label>
        <input class="fi" type="email" name="email" placeholder="hello@example.com" />
      </div>
    </div>
  </div>
</div>
```

### Card 2 — Dedicated Google account

```html
<div class="fc">
  <div class="fc-head">
    <div class="fc-icon">
      <svg viewBox="0 0 16 16" fill="none" stroke-width="1.5">
        <rect x="3" y="7" width="10" height="7" rx="1.5"/>
        <path d="M5 7V5a3 3 0 016 0v2"/>
        <circle cx="8" cy="10.5" r="1"/>
      </svg>
    </div>
    <div>
      <div class="fc-title">Dedicated Google account</div>
      <div class="fc-desc">Created by you for this client. Connects Vercel, Supabase, Resend and GitHub. Shared after initiation payment is received.</div>
    </div>
  </div>
  <div class="fc-body">
    <div class="fg">
      <div class="ff span2">
        <label class="fl">Google account email <span class="opt">optional</span></label>
        <input class="fi" type="email" id="gemail" name="google_email" placeholder="e.g. clientname@gmail.com" />
        <div class="hint">Leave blank if not yet created. Add it later from the client profile.</div>
      </div>
      <div class="ff span2">
        <label class="fl">Password</label>
        <div class="pw-row">
          <input class="fi" type="password" id="gpw" name="google_password" placeholder="Min. 8 characters" oninput="checkStrength(this.value)" />
          <button type="button" class="pw-toggle" onclick="togglePw()">Show</button>
          <button type="button" class="pw-gen" onclick="genPw()">Generate</button>
        </div>
        <div class="strength">
          <div class="strength-seg" id="seg1"></div>
          <div class="strength-seg" id="seg2"></div>
          <div class="strength-seg" id="seg3"></div>
          <div class="strength-seg" id="seg4"></div>
        </div>
        <div class="strength-label" id="strength-label"></div>
        <div class="hint" style="margin-top:5px;">Stored only in this dashboard. Never written into any contract or document.</div>
      </div>
    </div>
  </div>
</div>
```

### Card 3 — Business & legal details

```html
<div class="fc">
  <div class="fc-head">
    <div class="fc-icon">
      <svg viewBox="0 0 16 16" fill="none" stroke-width="1.5">
        <rect x="2" y="3" width="12" height="10" rx="1.5"/>
        <line x1="5" y1="7" x2="11" y2="7"/>
        <line x1="5" y1="10" x2="8" y2="10"/>
      </svg>
    </div>
    <div>
      <div class="fc-title">Business &amp; legal details</div>
      <div class="fc-desc">Required for Dutch B2B contracts and invoices. Skip anything that does not apply.</div>
    </div>
  </div>
  <div class="fc-body">
    <div class="fg">
      <div class="ff">
        <label class="fl">KvK number <span class="opt">optional</span></label>
        <input class="fi" name="kvk" placeholder="e.g. 88321040" />
      </div>
      <div class="ff">
        <label class="fl">VAT / BTW number <span class="opt">optional</span></label>
        <input class="fi" name="vat" placeholder="e.g. NL123456789B01" />
      </div>
    </div>
  </div>
</div>
```

### Card 4 — Address

```html
<div class="fc">
  <div class="fc-head">
    <div class="fc-icon">
      <svg viewBox="0 0 16 16" fill="none" stroke-width="1.5">
        <path d="M8 2a4 4 0 014 4c0 3.5-4 8-4 8S4 9.5 4 6a4 4 0 014-4z"/>
        <circle cx="8" cy="6" r="1.3"/>
      </svg>
    </div>
    <div>
      <div class="fc-title">Address</div>
      <div class="fc-desc">Billing address used on invoices and the client party block on contracts.</div>
    </div>
  </div>
  <div class="fc-body">
    <div class="fg cols3">
      <div class="ff span2">
        <label class="fl">Street address</label>
        <input class="fi" name="street" placeholder="Stratumsedijk 6" />
      </div>
      <div class="ff">
        <label class="fl">Postal code</label>
        <input class="fi" name="postal" placeholder="5611 NB" />
      </div>
      <div class="ff">
        <label class="fl">City</label>
        <input class="fi" name="city" placeholder="Eindhoven" />
      </div>
      <div class="ff">
        <label class="fl">Country</label>
        <select class="fi" name="country">
          <option>Netherlands</option>
          <option>Belgium</option>
          <option>Germany</option>
          <option>Other</option>
        </select>
      </div>
    </div>
  </div>
</div>
```

---

## 9. Password card CSS

```css
.pw-row {
  display: flex;
  gap: 7px;
}
.pw-row .fi { flex: 1; }
.pw-toggle {
  background: var(--cream2);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 11px;
  font-size: 11px;
  font-weight: 600;
  color: var(--mid);
  cursor: pointer;
  font-family: 'Gabarito', sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all .15s;
}
.pw-toggle:hover { background: var(--divider); }
.pw-gen {
  background: var(--brown);
  border: none;
  border-radius: 7px;
  padding: 8px 13px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cream);
  cursor: pointer;
  font-family: 'Gabarito', sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s;
}
.pw-gen:hover { background: var(--dark); }
.strength {
  display: flex;
  gap: 3px;
  margin-top: 6px;
}
.strength-seg {
  height: 3px;
  flex: 1;
  border-radius: 2px;
  background: var(--divider);
  transition: background .3s;
}
.strength-seg.w { background: #e24b4a; }
.strength-seg.m { background: #ef9f27; }
.strength-seg.s { background: #2d6e2d; }
.strength-label {
  font-size: 10px;
  color: var(--muted);
  margin-top: 3px;
}
```

---

## 10. Sticky footer

```html
<div class="form-footer">
  <div class="footer-note">
    All fields marked <strong>optional</strong> can be filled in later from the client profile.
  </div>
  <div class="footer-btns">
    <button class="btn-cancel" onclick="switchView('clients')">Cancel</button>
    <button class="btn-add" onclick="submitClient()">
      <div class="btn-add-dot"></div> Add client
    </button>
  </div>
</div>
```

```css
.form-footer {
  position: fixed;
  bottom: 0;
  left: var(--sb);
  right: 0;
  padding: 14px 28px;
  background: var(--cream);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 50;
}
.footer-note {
  font-size: 11px;
  color: var(--muted);
}
.footer-note strong { color: var(--dark); }
.footer-btns { display: flex; gap: 9px; }
.btn-cancel {
  background: none;
  border: 1px solid var(--border);
  padding: 9px 18px;
  border-radius: 8px;
  font-family: 'Gabarito', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}
.btn-cancel:hover { background: var(--cream2); color: var(--dark); }
.btn-add {
  background: var(--dark);
  border: none;
  padding: 9px 22px;
  border-radius: 8px;
  font-family: 'Gabarito', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--cream);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background .15s;
}
.btn-add:hover { background: var(--brown); }
.btn-add-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rust);
}
```

---

## 11. JavaScript — password functions

Add these three functions to the existing `<script>` block. Do not create a new script tag if one already exists.

```javascript
function togglePw() {
  var f = document.getElementById('gpw');
  f.type = f.type === 'password' ? 'text' : 'password';
}

function genPw() {
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  var pw = Array.from({ length: 16 }, function() {
    return chars[Math.floor(Math.random() * chars.length)];
  }).join('');
  var f = document.getElementById('gpw');
  f.value = pw;
  f.type = 'text';
  checkStrength(pw);
}

function checkStrength(val) {
  var segs = [
    document.getElementById('seg1'),
    document.getElementById('seg2'),
    document.getElementById('seg3'),
    document.getElementById('seg4')
  ];
  var label = document.getElementById('strength-label');
  segs.forEach(function(s) { s.className = 'strength-seg'; });
  if (!val) { label.textContent = ''; return; }
  var score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  var cls = score <= 1 ? 'w' : score <= 2 ? 'm' : 's';
  var lbl = score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  for (var i = 0; i < score; i++) segs[i].classList.add(cls);
  label.textContent = lbl;
  label.style.color = cls === 'w' ? '#e24b4a' : cls === 'm' ? '#ef9f27' : '#2d6e2d';
}
```

---

## 12. Desktop-specific rules

- Sidebar is `position: fixed; width: 200px; height: 100vh`
- `.main` has `margin-left: var(--sb)` to offset the fixed sidebar
- `.form-footer` has `left: var(--sb)` so it does not overlap the sidebar
- `.topbar` is `position: sticky; top: 0` — scrolls with the page but sticks at the top
- `.form-area` padding is `24px 28px 100px` — the 100px bottom clears the fixed footer
- Form grid `.fg` is always 2 columns on desktop. Address card uses `.fg.cols3` (3 columns)
- `.mob-header` is hidden on desktop: `display: none`

---

## 13. Mobile-specific rules (max-width: 680px)

Apply all the following inside `@media (max-width: 680px)`.

```css
@media (max-width: 680px) {
  :root { --sb: 0px; }

  .sb { display: none; }

  .main { margin-left: 0; }

  .mob-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--dark);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .mob-logo {
    font-family: 'Alexandria', sans-serif;
    font-weight: 900;
    font-size: 13px;
    color: var(--cream);
  }
  .mob-menu-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid #2e1c0e;
    background: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  }
  .mob-menu-btn span {
    display: block;
    width: 14px;
    height: 1.5px;
    background: var(--muted);
  }

  .topbar { padding: 12px 16px; }
  .page-title { font-size: 17px; }

  .form-area { padding: 16px 16px 100px; }
  .fc-body { padding: 14px 16px; }
  .fc-head { padding: 12px 16px 10px; }

  .fg,
  .fg.cols3 { grid-template-columns: 1fr; }
  .ff.span2 { grid-column: 1; }

  .pw-row { flex-wrap: wrap; }
  .pw-row .fi { width: 100%; flex: none; }
  .pw-toggle,
  .pw-gen { flex: 1; text-align: center; justify-content: center; }

  .form-footer {
    left: 0;
    padding: 12px 16px;
    flex-direction: column-reverse;
    gap: 8px;
  }
  .footer-note { display: none; }
  .footer-btns { width: 100%; }
  .btn-cancel { flex: 1; text-align: center; }
  .btn-add { flex: 1; justify-content: center; }
}
```

### Mobile header HTML

This element lives inside `.main`, above `.topbar`, and is hidden on desktop.

```html
<div class="mob-header">
  <div class="mob-logo">engaging designUX</div>
  <button class="mob-menu-btn" aria-label="Open menu">
    <span></span>
    <span></span>
    <span></span>
  </button>
</div>
```

The hamburger button does not need a working menu for now — wire it up when a mobile nav drawer is implemented.

---

## 14. Sidebar — active state for this page

When the Add New Client view is active, the Clients nav item must have the `.active` class. All other nav items must not have `.active`.

```javascript
// When navigating to add-new-client view:
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
document.getElementById('nav-clients').classList.add('active');
```

---

## 15. What Copilot must not change

- Do not alter the sidebar structure, logo, meta bar icon buttons, or user block
- Do not remove the refresh (↺) and grid (⊞) icon buttons from the sidebar meta bar
- Do not change any brand color values
- Do not use `Inter`, `Roboto`, `Arial`, or `system-ui` — only `Alexandria` and `Gabarito`
- Do not add any third-party UI library (Bootstrap, Tailwind, Material, etc.)
- Do not use `position: absolute` on the form footer — it must be `position: fixed`
- Do not add `margin` or `padding` to `.sb` — the sidebar is always full height and fixed
- Do not wrap form fields in a `<form>` tag with `action` — submission is handled via JS
- Do not use `display: none` to hide mobile elements on desktop — use `display: none` only inside the `@media (max-width: 680px)` block for `.mob-header`, and the inverse outside it