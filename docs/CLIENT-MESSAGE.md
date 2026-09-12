# Message to send him

Copy from below. Two versions — a short one to send now with the link, and the
longer list of what we need from him.

---

## Short version (send with the link)

> The dashboard and the website are now connected — whatever you change in the
> dashboard shows up on the site.
>
> Quickest way to see it: **Dashboard → Storefront**, type a line into the
> announcement bar, press Save and publish, then reload the shop. That red strip
> across the top of the site is coming out of the database.
>
> Same for products. **Dashboard → Products** now has a category dropdown, a
> photo upload, and a Certificate of Analysis PDF upload. Add a product there
> and it appears in the shop, on its category page, and in search. Upload a
> certificate and a **Download certificate** button appears on that product's
> page for customers.
>
> Login is at `/admin/login`. You can add your own staff under **Team** — add
> the person, then **Grant access** on their card creates their login for you.
> No need to touch Supabase.
>
> Two things I need from you:
> 1. **Product photos.** The 20 products in there now have placeholder artwork I
>    generated. Send real photos — JPG, PNG or WEBP, **under 2 MB each**, square
>    works best.
> 2. **The COA PDFs**, one per product, also under 2 MB.
>
> Next up is the blog: written in the dashboard, published to the site.

---

## What we need from him, in full

### Now, to finish products and team

1. **Product photos** — one per product, JPG/PNG/WEBP/AVIF, **max 2 MB each**.
   Square or close to it. Name them so we can tell which product each belongs
   to, or upload them yourself product by product.
2. **COA PDFs** — one per product, **max 2 MB each**. These are what customers
   download from the product page, so they should be the signed lab report.
   Include the lot number and the test date for each — there are fields for
   both.
3. **Team list** — name, job title, email, phone for anyone who should appear
   or who needs a dashboard login.
4. **Categories** — the ten current pathway categories came from the original
   site. Confirm they are right, or send the list you want.

### Blocked until he opens accounts

These are not code problems. Nothing can be built until the accounts exist.

5. **Email (SMTP)** — until this exists there are **no order confirmations**, no
   enquiry notifications, and campaigns can be written but not sent. Any
   provider works (Google Workspace, Zoho, Postmark, SendGrid). We need: host,
   port, username, password, and the from-address.
6. **Payment processor** — checkout collects the order but **cannot take
   money**. PayPal needs a client ID and secret; a card processor needs its own
   keys. This is the real blocker to selling, more than anything in the
   dashboard.
7. **Meta / WhatsApp** — only if he wants the WhatsApp and Messenger campaign
   side. Needs a Meta business app with the WhatsApp Business API.

### Worth him knowing

8. **The policy pages are drafts, not legal advice.** Shipping, returns,
   privacy and the research-use disclaimers were written as placeholders. He
   sells a regulated product class and a lawyer should read them before launch.
9. **Storage limit is 2 MB per file** and is enforced in two places — the
   bucket itself and the upload endpoint. An oversized file is refused with its
   actual size named, so it is obvious what to fix.
10. **Dashboard access is all-or-nothing.** Anyone granted access sees
    everything, including orders and customer details. Per-section permissions
    are not built — say if that is needed.
