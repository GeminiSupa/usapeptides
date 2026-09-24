# Email automation and deliverability

Two separate things live in the dashboard's **Email automation** tab, because
the owner asked for one and needs the other:

1. **Deliverability** — why the mail goes to spam, and the warm-up limit that
   stops a brand-new domain burning its reputation.
2. **Sequences** — the drip builder: a vertical list of steps that runs
   top to bottom.

---

## 1. The spam problem, honestly

A drip sequence does not fix spam placement. Three things do:

| What | Why it matters |
|---|---|
| **SPF, DKIM and DMARC** on the sending domain | Since February 2024 Gmail and Yahoo require all three from anybody sending bulk email. Without them the mail is filtered before anyone reads a word of it. |
| **Sending from our own domain** | `onboarding@resend.dev` builds Resend's reputation, not ours, and reads as untrustworthy to the person receiving it. |
| **Warming up** | A domain nobody has heard of that sends 500 emails on day one has its first impression made by a spam filter. |

The Deliverability screen reads the live DNS for the sending domain and says
which of these are missing, with the exact record to paste at the registrar.
It only reads: nothing here changes DNS.

### What the owner has to do, once

1. In the Resend dashboard, add the domain and copy the records it gives.
2. Paste them at the registrar (SPF TXT, DKIM TXT, and the MX Resend asks for).
3. Add the DMARC record the screen shows — start at `p=none`, which watches and
   changes nothing about delivery.
4. Set `RESEND_FROM` in Vercel to an address on the domain, type **Config**, and
   redeploy.
5. Come back to the screen and press **Check again**. DNS can take an hour.

Once SPF and DKIM have passed for a few weeks, move DMARC to `p=quarantine`.

### The warm-up

`email_sending_policy` holds one row: whether the warm-up is on, when it
started, the ceiling, and an optional manual override. `email_send_counters`
holds one row per day.

The schedule ramps 25 → 50 → 100 → 200 → 400 → 800 → 1500 over 26 days, then
the owner's ceiling applies. It never more than doubles, which is what the
providers ask for.

**Campaigns obey the same limit.** Every send asks `email_reserve_sends` for a
permit first; the count happens in the database with the row locked, so two
workers can never both spend the last permit. Anything over the limit waits for
tomorrow rather than being dropped, and a permit taken but not used is handed
back.

---

## 2. Sequences

A sequence is an ordered list of four kinds of step:

| Step | What it does |
|---|---|
| **Send email** | Subject, preview text, from name, reply-to, and the same block designer Campaigns uses. Shows a live spam-risk check as you type. |
| **Wait** | Minutes, hours or days. Accurate to about half an hour, since the cron runs every 30 minutes. |
| **If / then** | Checks whether they opened or clicked the last email, or whether they have ordered. When the answer is no: carry on, skip the next step, or stop. |
| **Finish** | Ends the sequence for whoever reaches it. |

### What starts one

- **No trigger** — you add people by hand, by pasting addresses or picking a
  whole list. Always available.
- **New lead** — fires from the chat-to-lead webhook. The lead-intake endpoint
  on the `hero-video` branch will fire it too once that branch merges.
- **Newsletter signup**
- **New customer account**
- **Order placed** — optionally only above a minimum total.
- **Abandoned cart** — a cart untouched for N hours (default 4) and no newer
  than a week. Found by the cron, since nothing fires when somebody stops
  shopping.

### The rules the engine keeps

- **Nobody is in a sequence twice.** One enrollment row per person per
  sequence, enforced by a unique index. Re-entry, when the sequence allows it,
  reopens the finished row rather than making a second one.
- **Unsubscribed means unsubscribed.** Every enrollment and every send checks
  `email_suppressions`. Unsubscribing from an automation email also stops every
  sequence that person is part-way through.
- **Stop when they order** is on by default, so nobody is chased for a cart
  they already paid for.
- **One email per person per pass.** Two emails never leave together, and the
  builder refuses to go live with two email steps and no wait between them.
- **A claim before a send.** An enrollment is claimed before any step runs, so
  the cron and somebody pressing "Run due now" cannot send the same step twice.
  A claim left hanging for ten minutes is released and retried.
- **Pausing holds people where they are** rather than dropping them.
- A sequence cannot be turned on while it has problems, and the same check runs
  in the API as in the builder.

### Tracking

Opens and clicks work exactly as they do for campaigns, through the same signed
links — but with different letters in the signature (`ao`, `ac`, `au` rather
than `o`, `c`, `u`), so a token minted for a campaign can never be replayed
against an automation send or the other way round.

---

## Where things are

| Path | What |
|---|---|
| `supabase/migrations/0024_email_automations.sql` | Tables, the permit RPCs, the tracking RPC |
| `src/lib/automations.ts` | Triggers, step shapes, validation — shared by API and UI |
| `src/lib/emailHealth.ts` | Warm-up schedule and the spam-risk check (pure) |
| `src/lib/deliverability.ts` | The DNS report |
| `src/lib/sendingPolicy.ts` | Reserving and releasing daily send permits |
| `src/lib/automationEngine.ts` | Enrolling, advancing, sending, abandoned carts |
| `src/components/admin/AutomationsPanel.tsx` | The screen |
| `src/components/admin/EmailBlockEditor.tsx` | The email designer, shared with Campaigns |
| `src/app/api/admin/automations/*` | The API |
| `src/app/api/admin/deliverability/` | DNS report and warm-up settings |
| `tests/emailAutomation.test.cjs` | 21 behaviour tests — `npm run test:automations` |

The cron is the existing `/api/cron/campaigns`, now running every 30 minutes
and doing both jobs. One failing half cannot stop the other.

## Permissions

`automations` is a normal grantable module under Marketing. The deliverability
route is reachable by `automations` or `campaigns`, since the limit campaigns
are subject to is set there. As always, an unmapped `/api/admin/*` path would
be super-admin only.
