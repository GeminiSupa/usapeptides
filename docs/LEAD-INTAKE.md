# Sending a form into the USA Peptide Depot CRM

Other peptide sites do not get a database login. They post the form to this
site, and the person shows up under **Dashboard → Leads**. The **Source**
column is the domain the form was on.

The address stays closed until `LEAD_INTAKE_SECRET` is set on this site (Vercel,
type Secret, at least 16 characters) and the site is redeployed. The same
secret goes on each other site's **server**. It must not go in the page the
visitor's browser can read, or anyone can invent leads.

## What the other site sends

`POST https://www.usapeptidedepot.com/api/leads/intake`

Header: `Authorization: Bearer <the secret>`

Header: `Content-Type: application/json`

```json
{
  "site": "their-domain.com",
  "name": "Jane Smith",
  "email": "jane@lab.edu",
  "phone": "831-471-5559",
  "institution": "State University",
  "message": "Asking about a research peptide"
}
```

`site` is required. It is the domain of the site that owns the form.

`email` or `phone` is required. A name on its own is not a lead, because there
is no way to reply.

Phone, institution and message can be left out.

## What comes back

- **201** — saved. `created: true` means a new lead. `created: false` means
  this person was already a lead; their status and the salesperson's notes
  stay as they were, and the new message is added on top.
- **401** — the secret is missing or wrong.
- **400** — a field is missing or not usable. `fields` says which one.
- **429** — that address sent more than 30 leads in ten minutes.
- **503** — the secret is not set on this site yet.

The reply does not include the lead's id.

## This website's own contact form

The contact page still saves an enquiry. It also creates a lead, with the
source set to this site's domain, so both inboxes are not two different lists.
