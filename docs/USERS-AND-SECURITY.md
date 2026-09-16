# Users, permissions and security

Three kinds of people, one tab. Written down because this is the part of the
system where a mistake hands somebody the customer list.

---

## Run this first

Supabase → SQL Editor → paste `supabase/migrations/0005_users.sql` → Run.

Until it runs, the Users tab and the audit trail say so instead of failing. The
rest of the dashboard keeps working exactly as it does now, and the existing
owner keeps full access — verified, not assumed.

**No email address is written into that file or into the code.** The first owner
is promoted from whoever is already on the allow-list, and only when no owner
exists yet. That is what makes this deployable as-is for the next business.

---

## The three kinds

| | Team | Sub-users | Affiliates |
|---|---|---|---|
| Signs in | yes | yes | **no** |
| Sees | the sections you tick | only their own earnings and link | nothing |
| Created by | an owner | invited by staff, **approved by an owner** | an owner or anyone with the Affiliates permission |
| Earns | optional commission | commission + their supervisor's override | commission on their referral code |
| Can have sub-users | yes, up to their limit | **never** | n/a |

---

## Roles

**Owner.** Sees everything. The only role that can add people, change
permissions, approve invites, or read the audit trail. Managing users is not a
grantable permission — it is owner-only — because it is the one thing that can
escalate privilege.

**Staff.** Sees exactly the sections an owner ticks. The dashboard home page is
always visible; everything else is off until granted.

**Sub-user.** A closed list of two screens: their earnings and their referral
link. Not "orders, but hidden" — the API refuses sub-users on every other route
by default.

**Sales agent** (needs `0007_sales_agents.sql`). A team member (tier staff,
never a super admin) who can be given only Orders, Customers, Leads and Recruit
sellers. Inside those they see their own records plus unclaimed orders and
leads, never a colleague's. They can be the parent of sub-users.

How a sale becomes theirs, decided on the server:

1. the customer used their referral link;
2. otherwise, the customer ordered before and that order is theirs — the
   customer stays with their agent (only while the agent is still active);
3. otherwise the order arrives unclaimed and an agent presses Claim. The write
   only succeeds while the order is still unclaimed, so two agents pressing at
   once cannot both win, and the loser is not told who did;
4. a super admin can assign or clear any order or lead.

An agent cannot change who owns a record, edit an unclaimed or colleague's
record, or delete anything. A customer's owner is never stored — it is read
from their orders, so the two cannot disagree.

---

## The security model, and why each piece is there

### Default-deny, twice

1. **Sub-users are refused on every admin route** unless the route opts in. Most
   routes are gated on "is an admin", so without this a sub-user login would
   reach the customer list. Only two routes opt in.
2. **A route nobody has mapped to a permission requires the owner role.** A
   route added next month is locked until somebody lists it deliberately. The
   opposite default makes every new endpoint a hole until noticed.

### Four gates on every request

A valid session, a row in `admin_users`, an active status, and the permission
the route needs. Signing in to the storefront is not signing in to the
dashboard; a suspension takes effect on the next request rather than the next
login.

### Permissions cannot be forged

Whatever the form posts is filtered against the grantable list. `users`,
`audit` and invented strings are dropped rather than stored — tested by posting
them directly.

### Nobody edits their own role

Not even an owner can change their own role, status or permissions. This is not
distrust: it stops the single click that leaves a business with no owner and no
route back except the SQL editor. Another owner can always make the change.

### The last owner cannot be removed

Enforced by a database trigger as well as the API, so it holds for a direct
write too.

### Two levels, enforced three times

Staff → sub-user, and no further. Checked in a database trigger, in the API,
and in the UI. Three times because the cost of getting it wrong is commission
paid on commission. The reverse direction is covered too: somebody who already
has sub-users cannot be turned into one.

### An invite cannot sign in

A staff invite creates **no Supabase Auth account at all**. Approving it is what
creates the login. So the worst a compromised staff account can do is create a
row an owner must then approve — tested by confirming a pending invite has no
account.

The supervisor's place count is re-checked at approval, not trusted from invite
time, because several invites can be pending against one person whose last place
has since been filled.

### Passwords

Minimum 12 characters, not 8 — these accounts read every customer record in the
business. Stored only as a hash by Supabase, so nothing can read one back;
"forgot my password" means setting a new one. Never written to the audit log,
never returned in a response. The test suite asserts the password never appears
anywhere in the log.

### Referral codes are not guessable

`crypto.randomInt`, eight characters, from an alphabet with no O/0, I/1 or L. A
code is money: a sequential one lets somebody guess a working link and
attribute their own orders to a partner who never referred them. Uniqueness is
case-insensitive, because a link gets typed in whatever case the customer feels
like.

### Money is bounded in the database

Commission and override rates are constrained to 0–100 by a check constraint,
not only by the form.

### The audit trail is append-only

Every privileged action records who, what, to whom and the before/after. The
table refuses UPDATE and DELETE at the database level — verified by trying to
delete an entry with the service role key and being refused. A trail somebody
can tidy up is not a trail.

---

## Deliberate limits

- **Deleting a user does not delete their login.** It removes dashboard access
  and keeps the Supabase Auth account, because the same address may be a
  customer, and because re-adding somebody should not mean a new password.
- **Somebody with sub-users cannot be deleted** until those are moved. An
  orphaned sub-user earns commission nobody is overriding.
- **An affiliate with approved or paid commission cannot be deleted** — the
  payment record would go with them. Switch them off instead: the link stops
  working, the history survives.
- **Sub-user earnings are not calculated.** Orders do not yet carry a referral
  column, so there is nothing to total. Their screen says that plainly rather
  than printing `$0.00`, which would read as "you have earned nothing".

---

## Adding a section later

Two edits, in this order:

1. Add it to `MODULES` in `src/lib/permissions.ts`.
2. Add its route pattern to `src/lib/routePermissions.ts`.

Skip the second and the route is owner-only, which is the safe failure. Skip the
first and nobody can be granted it. The sidebar, the permission grid and the API
all read the same list, so there is no third place to remember.
