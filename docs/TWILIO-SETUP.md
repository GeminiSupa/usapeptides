# Twilio — texts, WhatsApp and calls from the dashboard

Dashboard > **SMS & calls**. Gated on the `messaging` permission.

What it does:

- choose which of the account's numbers to send or call from, per send
- send one text, or a list of up to 200
- send a WhatsApp message, if a WhatsApp sender is configured
- start a Studio Flow, if any are configured
- place a call from the browser, with a recording switch
- show the message and call history, read live from Twilio

Everything is optional. With no credentials the section loads and names the
variables that are missing; it never crashes and never blocks the rest of the
dashboard.

---

## What belongs to this project and what does not

One Twilio account can serve several projects. Some values are shared because
Twilio has only one of them, and some **must** be separate.

| Value | Shared? | Why |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Shared | It identifies the account. There is one. |
| `TWILIO_AUTH_TOKEN` | Shared | Account-level master password. It cannot be split. |
| `TWILIO_API_KEY` + `TWILIO_API_SECRET` | **Separate** | Revocable on its own, so a leak here reaches nothing else. |
| `TWILIO_TWIML_APP_SID` | **Separate — mandatory** | It holds one webhook address. Share it and this project's calls are handled by the other project's server. |
| `TWILIO_PHONE_NUMBER` | Optional | Only the default pick. The sender is chosen per send from the account's own list. |
| Studio Flow SIDs | Separate if used | Flows are per use case. |

If the auth token ever needs separating too, that takes a Twilio **subaccount**
(Account > Subaccounts): its own account SID and token, its own numbers, its
own usage line, one bill.

Name every Twilio resource after the project that owns it. An unlabelled `SK…`
key in a shared account cannot be attributed to anything later.

---

## Setting it up

### 1. An API key for this project

Account > **API keys & auth tokens** > Create API key. Region US1, type
Standard. Name it after this project.

You get a SID starting `SK` and a secret shown **once**. They go in
`TWILIO_API_KEY` and `TWILIO_API_SECRET`.

### 2. A TwiML App for this project

`https://console.twilio.com/us1/develop/voice/manage/twiml-apps` > Create new
TwiML App.

- Voice **Request URL**: `https://<this site>/api/admin/twilio/voice`
- Method: **HTTP POST**
- Messaging: leave empty

Use the exact host the site is served from, including `www` if it redirects
there. Twilio signs the address it was given; a redirect breaks the signature
and every call fails.

Its SID starts `AP` and goes in `TWILIO_TWIML_APP_SID`.

### 3. A phone number

Optional. The dashboard lists every number the account owns and the sender is
chosen at send time, so a deployment with numbers already on the account needs
nothing here. Setting `TWILIO_PHONE_NUMBER` to `+1…` just preselects one.

A default can also be set from the panel itself ("Make default"), which stores
it in `site_settings` under `twilio_sending_number` so every admin sees the
same one.

**Choosing a sender does not change who answers a call back.** Each number
separately stores where its incoming calls go. On an account shared with
another business, most numbers answer into that business's phone system, so a
customer who returns the call lands there rather than here. The picker labels
each number with where its incoming calls currently land, and warns when the
chosen one is not pointed at this dashboard. To fix it for a given number,
point that number's Voice configuration at this project's TwiML app.

**US texting needs registration.** Carriers require A2P 10DLC brand and
campaign registration before a business may text from a normal ten-digit
number. Messages from unregistered numbers are largely filtered out without an
error you can see.

### 4. The account values

Account SID and Auth Token are on the Twilio home page.

### 5. On Vercel

Add all of them to the **Production** environment, then redeploy. Variables
added to an existing deployment do nothing until it rebuilds.
`TWILIO_PHONE_NUMBER` is the only optional one.

---

## Permissions

`messaging` is the permission, mapped in `routePermissions.ts` for every path
under `/api/admin/twilio`. Tick **SMS & calls** on a staff member's record in
Dashboard > Users to let them text and call.

**The one exception is the voice webhook**, `/api/admin/twilio/voice`. Twilio
calls it server to server with no session, so an admin check there would
refuse every real call. What replaces it is Twilio's signature: the request is
verified against the account auth token, the signed URL is rebuilt from the
forwarded host, and anything unverified is refused with a 403 in production.
Unsigned requests are allowed outside production so the endpoint can be
exercised locally.

---

## Call recording

Off by default, switched on and off in the panel. Stored in `site_settings`
under `twilio_call_recording` as `{ enabled, changed_by, changed_at }` — no
migration required, the row appears on first save. The change is written to the
audit log.

Cost: about $0.0025 a minute to record, plus $0.0005 a minute a month to store,
with the first 10,000 minutes of storage free.

Recording a call without telling the other party is illegal in many places.
That is a decision for the business, not a default.

---

## Things that cost real time elsewhere

- **Twilio's CDN build of the Voice SDK is dead.** `sdk.twilio.com/js/voice/...`
  returns 403 for every version. The SDK comes from the npm package and is
  imported lazily inside the panel.
- **Voice SDK 2.x has no `ready` event.** Verified against the installed 2.18.5
  bundle, the Device events are `error`, `incoming`, `destroyed`,
  `unregistered`, `registering`, `registered`, `tokenWillExpire`. Outgoing
  calls need no registration, so the device is usable as soon as it is built.
  Waiting for `ready` hangs forever.
- **`tokenWillExpire` must be wired up** or dialling stops working an hour
  after the tab was opened.
- **An access token must be signed with the API key**, not the auth token.
  Signing with the auth token produces a JWT that looks fine locally and is
  rejected by Twilio at call time.
- **The microphone is requested when the Call tab opens**, not at the first
  call, so the browser prompt appears at a moment that makes sense. Once a
  browser is set to block, no page can ask again — the panel says so and
  explains the padlock menu.
- **Dashboard calls need the session token.** The panel uses the shell's
  `authedFetch`; a bare `fetch` returns 401 and renders as "not configured",
  which sends you looking for a missing environment variable that is not
  missing.

---

## Checking it works

Unit tests: `npm run test:twilio`. They cover number parsing, the signature
scheme including a tampered request, and the token's shape. They do not prove
anything about the deployment.

What does:

1. **Is the new code live?** POST to `/api/admin/twilio/voice` with no
   signature. Production must answer **403**. A 200 with `<Dial>` means an old
   build.
2. **Does production have the credentials?** POST a correctly signed request —
   HMAC-SHA1 of the URL plus the params sorted by name and concatenated as
   name+value, keyed with the auth token, base64. A 200 carrying
   `callerId="+1…"` proves the variables are set.
3. **One real call**, placed by a person, with the microphone prompt answered.
   Nothing above substitutes for it.

A sender the account does not own is refused server-side, both for messages
and for the caller ID on a call — the browser proposes it, the server checks
it against the live account before anything goes out.
