# Live chat (Chatwoot) — setup

The code is in and tested. It is **switched off** until the two public values
below exist, so the site behaves exactly as it does now until you add them.

---

## 1. Get a Chatwoot inbox

Either works, the code does not care:

- **Cloud** — sign up at `app.chatwoot.com`. Free tier is fine to start.
- **Self-hosted** — your own server. Cheaper at volume, yours to maintain.

Then: **Settings → Inboxes → Add Inbox → Website**. Give it the site name and
`https://usapeptides-six.vercel.app`.

When it is made, open **Settings → Inboxes → that inbox → Configuration**. You
need two things off that screen:

| Chatwoot calls it | Goes in |
|---|---|
| the `baseUrl` in the install snippet | `NEXT_PUBLIC_CHATWOOT_BASE_URL` |
| `websiteToken` | `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN` |

Ignore the code snippet Chatwoot gives you — that part is already written.

---

## 2. Put them in Vercel

Vercel → the project → **Settings → Environment Variables**.

Both of these start with `NEXT_PUBLIC_`, so they must be type **Config, not
Secret** — same as the Supabase URL and anon key. They get compiled into the
browser bundle, and Vercel will not let a Secret be used that way.

That is correct and not a leak: the website token says *which inbox to open*,
not *who is allowed to write to it*. Every Chatwoot install on the internet
exposes it.

Then **redeploy**. Vercel does not apply new variables to an existing
deployment.

---

## 3. Set the launcher colour

In the inbox's **Widget Builder**, set the widget colour to **`#BF4F0B`**.

That is the same orange as the add-to-cart and checkout buttons — the value
carried over from Costa, where it has been tested. Keeping the chat launcher on
the same action colour means the whole site says "this is a thing to click"
with one colour instead of three.

Chatwoot owns the widget's appearance, so this cannot be set from our code.

---

## 4. Optional: chats become leads in your dashboard

This is the part that connects chat to the rest of the system. A visitor who
starts a chat and leaves an email or phone number turns into a **Lead** in the
dashboard, with the page they were on and what was in their cart written into
the notes.

A secret has already been generated and is sitting in `.env.local` as
`CHATWOOT_WEBHOOK_SECRET`. Copy that value into Vercel as a **Secret** (no
`NEXT_PUBLIC_` prefix — this one must never reach the browser).

Then in Chatwoot: **Settings → Integrations → Webhooks → Add new webhook**

```
https://usapeptides-six.vercel.app/api/webhooks/chatwoot?token=PASTE_THE_SECRET_HERE
```

Subscribe to these events:

- `conversation_created`
- `contact_created`
- `contact_updated`
- `message_created`

Chatwoot does not sign its webhooks, which is why the secret is in the URL.
Without it, anyone who found the address could invent customers in your CRM.

### What it does

| Event | Result |
|---|---|
| A chat starts, contact left an email or phone | New lead, source `live_chat` |
| The same person chats again | Updates their existing lead. **Their status and any notes your team wrote are left alone** — a returning chatter cannot wipe "called him, wants 50 vials" |
| They send a message | Logged on the lead's activity trail and the last-contacted date moves |
| Your team replies | Not logged — that would just mirror Chatwoot's transcript |
| Anonymous chat, no contact details | No lead. Nothing to follow up, so nothing is created |

---

## 5. Optional: identity validation

If you switch on **Enforce user identity validation** in the inbox settings,
copy the HMAC key from that screen into `CHATWOOT_HMAC_SECRET` in Vercel, as a
**Secret**.

Leave it blank and chat still works; signed-in customers are just identified
without a signature.

What this protects: with validation on, a signed-in customer's identity is
signed on our server before the widget claims it. Without it, somebody could in
principle open the widget claiming to be another customer and read that
person's chat history. The signing happens server-side because the key must
never ship to the browser.

---

## What was tested

29 checks, all passing, against the live database:

- Wrong secret and missing secret both refused
- A chat becomes a lead carrying source, institution, conversation number, the
  page they were on, and their cart
- A second chat from the same address updates instead of duplicating, and does
  **not** overwrite sales notes or status
- Incoming messages logged, our own replies not
- Anonymous chats create nothing
- Events we do not handle are acknowledged rather than errored, so Chatwoot does
  not disable the webhook
- A phone number added later reaches the existing lead
- With Chatwoot unconfigured: no chat script on the page, the identity route
  reports not-configured instead of failing, and the site stays healthy

The widget loader was tested separately against Chatwoot Cloud: the script
injects, the SDK initialises, and `$chatwoot` becomes available. It could not be
tested with a real inbox because that needs your account.

---

## Not built

- **Reading chats inside our dashboard.** Staff answer chats in Chatwoot's own
  interface, which is better at it than anything worth building here. Pulling
  conversations into the dashboard would need a Chatwoot API access token; say
  if you want it.
- **Chatwoot's WhatsApp and Messenger channels.** Chatwoot can carry both, but
  they need the same Meta credentials the campaign work is already blocked on.
