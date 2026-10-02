# Lead Intake API (v1)

Submits a contact-form lead from a lead-gen site into the USA Peptide Depot CRM.
Plain JSON over HTTPS. Posted directly from the visitor's browser; no backend
required on the client site.

**Status:** live. Ask us for an API token before you test; a request without a
valid token is refused.

---

## Endpoint

```
POST https://www.usapeptidedepot.com/api/leads/intake
```

| | |
|---|---|
| Method | `POST` (plus `OPTIONS` for CORS preflight, handled) |
| Content-Type | `application/json` |
| Auth | `Authorization: Bearer <token>`, required |
| CORS | Open; any domain holding a valid token may post |
| Rate limit | 5 requests / IP / 10 min · 20 requests / sending domain / 10 min |

Use the `www.` host exactly as written. The bare `usapeptidedepot.com` answers
with a 308 redirect, and browsers do not follow redirects on a CORS preflight,
so a form posting to it will fail.

---

## Authentication

```
Authorization: Bearer usapd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Header | Required | Value |
|---|---|---|
| `Authorization` | yes | `Bearer <token>` |
| `X-Site-Key` | alternative | The same token, for hosts that will not let you set `Authorization` |

One token covers every site. There is no per-domain registration: a new site
works the moment its form goes up. A revoked token stops every site using it at
once.

**Where to put the token.** If the site has a backend, keep the token there and
post server-side: then it is a real secret. On a static site it has to go in the
page, where anyone viewing source can read it, so treat it as public. That is
accepted, and the endpoint is built for it: the token identifies which network
of sites a lead came from and can be revoked instantly, while the honeypot, the
fill-time check and the rate limits are what actually bound abuse. Nothing about
the CRM is readable through this endpoint, in either case.

**Optional restriction.** A token can be tied to a list of domains, or have one
domain blocked, from the dashboard. Ask if you want a token locked to a single
site, for example a staging site.

---

## Request body

| Field | Type | Required | Max | Notes |
|---|---|---|---|---|
| `full_name` | string | yes | 200 | |
| `phone` | string | yes | 50 | Any format. `(405) 555-0134` accepted |
| `email` | string | yes | 254 | Must be a valid address |
| `interest` | enum | yes | n/a | See [Enums](#enums) |
| `goal` | enum | yes | n/a | See [Enums](#enums) |
| `message` | string | no | 5000 | Truncated, not rejected, if longer |
| `lead_source` | string | no | 120 | The submitting domain. Normally omit it: the server records the domain the request actually came from. Send it on a server-to-server post, which has no Origin |
| `tracking_phone` | string | no | 50 | The phone number displayed on that site |
| `page_url` | string | no | 500 | `location.href` |
| `referrer` | string | no | 500 | `document.referrer` |
| `utm_source` | string | no | 120 | From the query string |
| `utm_medium` | string | no | 120 | From the query string |
| `utm_campaign` | string | no | 120 | From the query string |
| `utm_term` | string | no | 120 | From the query string |
| `utm_content` | string | no | 120 | From the query string |
| `company` | string | n/a | n/a | **Honeypot.** Must be submitted empty |
| `ts` | integer | no | n/a | Epoch ms captured at page load |

### Spam fields

Both are required for the form to pass spam filtering in practice:

- `company`: a hidden input. Any non-empty value causes the submission to be
  discarded. Position it off-screen with CSS; do not use `display:none`, do not
  autofocus it, do not label it.
- `ts`: `Date.now()` recorded when the page loads. Submissions sent less than
  3000 ms after page load, or carrying a future timestamp, are discarded.

Discarded submissions return `201`, identical to a success.

---

## Enums

Submit the value. Display the label.

### `interest`

| Value | Label |
|---|---|
| `weight_management` | Weight management |
| `hair_scalp` | Hair & scalp |
| `skin_cosmetic` | Skin / cosmetic |
| `collagen` | Collagen |
| `copper_peptides` | Copper peptides |
| `general_info` | General peptide information |
| `availability` | Product availability |
| `pricing` | Pricing |
| `other` | Other |

### `goal`

| Value | Label |
|---|---|
| `weight_management` | Weight management |
| `body_composition` | Body composition |
| `recovery` | Recovery |
| `healthy_aging` | Healthy aging |
| `skin_appearance` | Skin appearance |
| `hair` | Hair |
| `general_wellness` | General wellness |
| `learning_options` | Learning about peptide options |
| `other` | Other |

Unrecognised values are stored as `other` with the submitted text retained.
Labels are also accepted in place of values.

---

## Example request

```bash
curl -X POST https://www.usapeptidedepot.com/api/leads/intake \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer usapd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
  -d '{
    "full_name": "Jane Doe",
    "phone": "(405) 555-0134",
    "email": "jane@example.com",
    "interest": "weight_management",
    "goal": "body_composition",
    "message": "Do you ship to Oklahoma?",
    "lead_source": "peptidesoklahomacity.com",
    "tracking_phone": "405-555-0100",
    "page_url": "https://peptidesoklahomacity.com/contact",
    "referrer": "https://www.google.com/",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "okc-weight",
    "company": "",
    "ts": 1758585600000
  }'
```

---

## Responses

### 201: accepted

```json
{ "data": { "received": true, "id": "3f2c8a14-9b6d-4e21-8a77-0c5f1e2b9d44" } }
```

Also returned for discarded spam submissions. Reset the form and show a
confirmation.

### 400: validation failed

```json
{
  "error": "bad_request",
  "message": "Lead rejected.",
  "fields": {
    "email": "A valid email address is required.",
    "phone": "A phone number is required."
  }
}
```

`fields` keys match the request field names. Render each message against its
input. Only present for validation errors.

### 401: unauthorised

```json
{ "error": "unauthorized", "message": "Missing, unknown or revoked API token." }
```

Causes: no token, an unknown token, a revoked token, or a token that has been
deliberately restricted away from this domain. Not retryable.

### 429: rate limited

```json
{ "error": "rate_limited", "message": "Too many submissions. Please wait a few minutes and try again." }
```

### 503: intake unavailable

```json
{ "error": "feature_unavailable", "message": "..." }
```

Server-side configuration incomplete. Not retryable; report it.

### 500: server error

```json
{ "error": "server_error", "message": "..." }
```

### Client handling

| Status | Action |
|---|---|
| 201 | Reset form, show confirmation |
| 400 | Show `fields` messages inline, keep input |
| 429 | Show retry message, keep input |
| 401, 500, 503 | Show fallback with the site's phone number, keep input |

---

## Behaviour

- **Deduplication.** A submission matching an existing lead by email or phone
  within 30 days updates that lead and appends the new submission to its
  timeline rather than creating a second record. The response is `201` either
  way; `id` is the existing lead's id.
- **First touch wins.** A returning person's record keeps what was captured the
  first time: the domain, the tracking number, both dropdown answers and the
  campaign. Later submissions, with their own answers, are added to that
  person's timeline rather than replacing what is on the record.
- **Source tracking.** Every lead records the domain it was submitted from,
  taken from the request's `Origin`, so each of a hundred sites is reported
  separately without a per-site key or a per-site edit. A `lead_source` in the
  body is only used when there is no `Origin` (a server-to-server post).
- **Storage.** The lead is written to the CRM with both enum answers, the
  message, the sending domain, `tracking_phone`, page URL, referrer, UTM values
  and user agent.
- **Notification.** Sent on receipt.
- **Idempotency.** No idempotency key. A duplicate submission within the dedupe
  window is absorbed as above.

---

## Reference implementation

The same code goes on every site. Per site, only the tracking phone number and
the call-us fallback text change; the key and the endpoint stay identical, and
`lead_source` can be left out entirely. Only the `name` attributes are
contractual; markup and styling are free.

```html
<form id="lead-form">
  <label>Full name
    <input name="full_name" required autocomplete="name"></label>

  <label>Phone number
    <input name="phone" type="tel" required autocomplete="tel"></label>

  <label>Email address
    <input name="email" type="email" required autocomplete="email"></label>

  <label>What are you interested in?
    <select name="interest" required>
      <option value="">Please choose</option>
      <option value="weight_management">Weight management</option>
      <option value="hair_scalp">Hair &amp; scalp</option>
      <option value="skin_cosmetic">Skin / cosmetic</option>
      <option value="collagen">Collagen</option>
      <option value="copper_peptides">Copper peptides</option>
      <option value="general_info">General peptide information</option>
      <option value="availability">Product availability</option>
      <option value="pricing">Pricing</option>
      <option value="other">Other</option>
    </select></label>

  <label>Primary goal
    <select name="goal" required>
      <option value="">Please choose</option>
      <option value="weight_management">Weight management</option>
      <option value="body_composition">Body composition</option>
      <option value="recovery">Recovery</option>
      <option value="healthy_aging">Healthy aging</option>
      <option value="skin_appearance">Skin appearance</option>
      <option value="hair">Hair</option>
      <option value="general_wellness">General wellness</option>
      <option value="learning_options">Learning about peptide options</option>
      <option value="other">Other</option>
    </select></label>

  <label>Questions or comments
    <textarea name="message" rows="4"></textarea></label>

  <!-- Optional. The server records the real domain either way. -->
  <input type="hidden" name="lead_source" value="peptidesoklahomacity.com">
  <!-- The number printed on this site, so you can see which number pulls. -->
  <input type="hidden" name="tracking_phone" value="405-555-0100">

  <input name="company" tabindex="-1" autocomplete="off" aria-hidden="true"
         style="position:absolute;left:-9999px;opacity:0;height:0">

  <button type="submit">Send</button>
  <p id="lead-status" role="status"></p>
</form>

<script>
(function () {
  var ENDPOINT = 'https://www.usapeptidedepot.com/api/leads/intake';
  var TOKEN    = 'usapd_TOKEN_HERE';                // the same on every site
  var CALL_US  = 'please call us on 405-555-0100';  // per site

  var form = document.getElementById('lead-form');
  var status = document.getElementById('lead-status');
  var button = form.querySelector('button[type=submit]');
  var loadedAt = Date.now();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    button.disabled = true;
    status.textContent = 'Sending...';

    var payload = {};
    new FormData(form).forEach(function (value, key) { payload[key] = value; });

    var params = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
      .forEach(function (k) { if (params.get(k)) payload[k] = params.get(k); });

    payload.page_url = location.href;
    payload.referrer = document.referrer;
    payload.ts = loadedAt;

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 201) {
          form.reset();
          status.textContent = 'Thank you, we will be in touch shortly.';
          return;
        }
        if (res.status === 400 && body.fields) {
          status.textContent = Object.keys(body.fields)
            .map(function (k) { return body.fields[k]; }).join(' ');
          return;
        }
        status.textContent = 'Sorry, something went wrong, ' + CALL_US + '.';
      });
    }).catch(function () {
      status.textContent = 'Sorry, something went wrong, ' + CALL_US + '.';
    }).then(function () { button.disabled = false; });
  });
})();
</script>
```

---

## Integration checklist

1. Ask us for an API token. One token serves every site; no domain list, no
   per-site registration.
2. Post to the `www.` host exactly as documented.
3. Keep the token server-side if the site has a backend; otherwise it goes in
   the page and is treated as public.
4. Ask for a separate token for staging. Submissions made with the live token
   are written to the live CRM.
5. Set `tracking_phone` to the number displayed on that site. Leave
   `lead_source` out, or set it to the site's domain.
6. Verify a `201`, a `400` with field errors, and the fallback path.
7. Render the tracking number as text, not only inside an image.

Do not collect payment details, government identifiers or medical history
through this form. Nothing beyond the documented fields is stored.
