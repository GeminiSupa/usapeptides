# Lead Intake API (v1)

Submits a contact-form lead from a lead-gen site into the USA Peptide Depot CRM.
Plain JSON over HTTPS. Posted directly from the visitor's browser; no backend
required on the client site.

**Status:** live. Ask us for a site key for each domain before you test; a
request without a registered key is refused.

---

## Endpoint

```
POST https://www.usapeptidedepot.com/api/leads/intake
```

| | |
|---|---|
| Method | `POST` (plus `OPTIONS` for CORS preflight, handled) |
| Content-Type | `application/json` |
| Auth | `X-Site-Key: <site key>` header, required |
| CORS | Allowed for the domains registered against the site key |
| Rate limit | 5 requests / IP / 10 min · 20 requests / site key / 10 min |

Use the `www.` host exactly as written. The bare `usapeptidedepot.com` answers
with a 308 redirect, and browsers do not follow redirects on a CORS preflight,
so a form posting to it will fail.

---

## Authentication

| Header | Required | Value |
|---|---|---|
| `X-Site-Key` | yes | The key issued for that domain |
| `X-Site-Secret` | no | Server-to-server only. Skips the domain check |

The site key is public and may sit in page source. It is valid only from the
domains registered against it, and grants nothing except lead submission. One
key per domain.

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
| `lead_source` | string | yes | 120 | The submitting domain, e.g. `peptidesoklahomacity.com` |
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
  -H 'X-Site-Key: oklahoma-city-k4m2rq8x7d' \
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
{ "error": "unauthorized", "message": "This site key is not registered for this domain." }
```

Causes: unknown key, deactivated key, or a domain not registered against the
key. Not retryable.

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
- **Storage.** The lead is written to the CRM with both enum answers, the
  message, `lead_source`, `tracking_phone`, page URL, referrer, UTM values and
  user agent.
- **Notification.** Sent on receipt.
- **Idempotency.** No idempotency key. A duplicate submission within the dedupe
  window is absorbed as above.

---

## Reference implementation

Replace the three marked values per site. Only the `name` attributes are
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

  <input type="hidden" name="lead_source" value="peptidesoklahomacity.com">
  <input type="hidden" name="tracking_phone" value="405-555-0100">

  <input name="company" tabindex="-1" autocomplete="off" aria-hidden="true"
         style="position:absolute;left:-9999px;opacity:0;height:0">

  <button type="submit">Send</button>
  <p id="lead-status" role="status"></p>
</form>

<script>
(function () {
  var ENDPOINT = 'https://www.usapeptidedepot.com/api/leads/intake';
  var SITE_KEY = 'SITE_KEY_HERE';                   // per site
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
      headers: { 'Content-Type': 'application/json', 'X-Site-Key': SITE_KEY },
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

1. Request a site key and tracking phone number for each domain.
2. Post to the `www.` host exactly as documented.
3. Request a separate test key for staging; test submissions against a
   production key are written to the live CRM.
4. Set `lead_source` to the submitting domain and `tracking_phone` to the number
   displayed on it.
5. Verify a `201`, a `400` with field errors, and the fallback path.
6. Render the tracking number as text, not only inside an image.

Do not collect payment details, government identifiers or medical history
through this form. Nothing beyond the documented fields is stored.
