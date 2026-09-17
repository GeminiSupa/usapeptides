/**
 * Who can see and do what.
 *
 * One source of truth, imported by both the API and the dashboard, because a
 * permission list that exists twice is a permission list that disagrees with
 * itself. Deliberately NOT `server-only`: the sidebar needs it to decide what
 * to render. Nothing secret lives here — hiding a tab is a convenience, and
 * every route checks the same rules again server-side.
 *
 * No email address, name or business appears anywhere in this file. The first
 * owner is promoted by 0005_users.sql from whoever is already on the
 * allow-list, so this deploys unchanged for another business.
 */

export type Tier = 'staff' | 'sub_user';
export type UserStatus = 'pending' | 'active' | 'suspended';

/**
 * What a team member does. Separate from tier, which is the recruiting tree.
 * A sales agent is tier 'staff', so they can have sub-users beneath them.
 */
export type Role = 'staff' | 'sales_agent';

/** One dashboard section. `id` doubles as the permission name. */
export interface ModuleDef {
  id: string;
  label: string;
  group: string;
  /** Super admins only, never grantable to staff. */
  ownerOnly?: boolean;
  /**
   * Not granted on its own: opens for anybody who holds at least one other
   * section. The home page summarises those sections, so an account with
   * nothing granted must not see it.
   */
  always?: boolean;
  /** The sub-user's own screens. Staff and owners do not see these. */
  subUserOnly?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: 'home',          label: 'Dashboard',       group: 'Overview', always: true },
  { id: 'analytics',     label: 'Analytics',       group: 'Overview' },

  { id: 'orders',        label: 'Orders',          group: 'Selling' },
  { id: 'fulfillment',   label: 'Fulfillment',     group: 'Selling' },
  { id: 'products',      label: 'Products',        group: 'Selling' },
  { id: 'categories',    label: 'Categories',      group: 'Selling' },
  { id: 'deals',         label: 'Deals',           group: 'Selling' },

  { id: 'customers',     label: 'Customers',       group: 'People' },
  { id: 'inquiries',     label: 'Enquiries',       group: 'People' },
  { id: 'reviews',       label: 'Reviews',         group: 'People' },
  { id: 'carts',         label: 'Abandoned carts', group: 'People' },

  { id: 'leads',         label: 'Leads',           group: 'Sales' },
  { id: 'prospects',     label: 'Prospector',      group: 'Sales' },
  { id: 'affiliates',    label: 'Affiliates',      group: 'Sales' },
  { id: 'commissions',   label: 'Commissions',     group: 'Sales' },

  { id: 'campaigns',     label: 'Campaigns',       group: 'Marketing' },
  { id: 'subscribers',   label: 'Subscribers',     group: 'Marketing' },
  { id: 'storefront',    label: 'Storefront',      group: 'Marketing' },
  { id: 'articles',      label: 'Blog',            group: 'Marketing' },

  { id: 'notifications', label: 'Notifications',   group: 'Admin' },
  { id: 'activity',      label: 'Activity log',    group: 'Admin' },

  // Grantable, unlike 'users'. It lets a staff member invite sub-users beneath
  // themselves and see their own team - and nothing else. An invite lands as
  // pending and still needs an owner to approve it, so this cannot be used to
  // manufacture access.
  { id: 'my_team',       label: 'Recruit sellers',  group: 'Admin' },

  // Managing people is the one thing that can escalate privilege, so it is not
  // grantable at all. Only an owner reaches it.
  { id: 'users',         label: 'Users',           group: 'Admin', ownerOnly: true },
  { id: 'audit',         label: 'Audit trail',     group: 'Admin', ownerOnly: true },
  { id: 'system',        label: 'Setup status',    group: 'Admin', ownerOnly: true },

  { id: 'my_earnings',   label: 'My earnings',     group: 'Mine', subUserOnly: true },
  { id: 'my_link',       label: 'My link',         group: 'Mine', subUserOnly: true },
];

const byId = new Map(MODULES.map((m) => [m.id, m]));

export const MODULE_IDS: string[] = MODULES.map((m) => m.id);

/**
 * The permissions an owner may actually tick for a staff member. Excludes the
 * always-on sections, the owner-only ones, and the sub-user screens, so the
 * form cannot offer something that would have no effect or that would hand out
 * the ability to grant permissions.
 */
export const GRANTABLE_MODULES: ModuleDef[] = MODULES.filter(
  (m) => !m.always && !m.ownerOnly && !m.subUserOnly
);

export const GRANTABLE_IDS = new Set(GRANTABLE_MODULES.map((m) => m.id));

/** What a sub-user may reach. Short on purpose, and contains no 'users'. */
export const SUB_USER_MODULES = new Set(['my_earnings', 'my_link']);

/**
 * The most a sales agent can be given. Inside each, the API shows them only
 * their own records plus unclaimed ones they can claim — never a colleague's.
 * Anything else (subscribers, carts, campaigns) would hand over the whole
 * customer list, so it is not grantable to an agent at all.
 */
export const SALES_AGENT_MODULES = new Set(['orders', 'customers', 'leads', 'my_team']);

export const moduleLabel = (id: string): string => byId.get(id)?.label ?? id;

/* -------------------------------------------------------------------------- */

/** The shape the API and UI both reason about. */
export interface AdminProfile {
  id: string;
  /** auth.users.id, null until the row has been linked to a login. */
  user_id?: string | null;
  email: string;
  full_name?: string | null;
  tier: Tier;
  /** Absent on a database that has not had 0007; reads as 'staff'. */
  role?: Role;
  referral_code?: string | null;
  status: UserStatus;
  is_superadmin: boolean;
  permissions: string[];
  parent_user_id?: string | null;
  sub_user_cap?: number | null;
  commission_rate?: number | null;
  override_rate?: number | null;
}

export const isActive = (p: Pick<AdminProfile, 'status'> | null | undefined): boolean =>
  p?.status === 'active';

export const isSubUser = (p: Pick<AdminProfile, 'tier'> | null | undefined): boolean =>
  p?.tier === 'sub_user';

export const isStaff = (p: Pick<AdminProfile, 'tier'> | null | undefined): boolean =>
  p?.tier !== 'sub_user';

export const isSalesAgent = (p: Pick<AdminProfile, 'tier' | 'role'> | null | undefined): boolean =>
  p?.role === 'sales_agent' && p?.tier !== 'sub_user';

/**
 * May this profile reach this section?
 *
 * The order of these checks is the security, not a style choice:
 *   1. inactive reaches nothing, so a pending approval cannot be sidestepped
 *      by an always-on section
 *   2. a sub-user gets a closed allow-list, checked BEFORE the always-on
 *      branch, or a new sub-user would land on the main dashboard
 *   3. owner-only is checked before the blanket owner grant below
 */
export function canAccess(
  moduleId: string,
  profile: AdminProfile | null | undefined
): boolean {
  if (!profile || !byId.has(moduleId)) return false;
  if (!isActive(profile)) return false;

  if (isSubUser(profile)) return SUB_USER_MODULES.has(moduleId);

  const mod = byId.get(moduleId)!;

  // Sub-user screens show nothing useful to staff and would confuse the
  // sidebar, so they are not merely unticked but unavailable.
  if (mod.subUserOnly) return isSalesAgent(profile) && moduleId === 'my_earnings';

  if (mod.ownerOnly) return profile.is_superadmin;
  if (profile.is_superadmin) return true;

  const held = Array.isArray(profile.permissions) ? profile.permissions : [];

  // A sales agent is capped at their list even if a wider permission was
  // somehow stored, e.g. somebody changed from staff to agent by hand.
  if (isSalesAgent(profile) && !mod.always && !SALES_AGENT_MODULES.has(moduleId)) return false;

  // This used to return true for everybody, so a team member added with no
  // permissions still opened the home page — revenue, order counts and the
  // latest customers' email addresses.
  if (mod.always) return held.some((p) => GRANTABLE_IDS.has(p));

  return held.includes(moduleId);
}

/** Where to drop somebody on sign-in: the first thing they can actually open. */
export function defaultModule(profile: AdminProfile | null | undefined): string {
  if (!profile) return 'home';
  if (isSubUser(profile)) return 'my_earnings';
  if (canAccess('home', profile)) return 'home';
  return MODULE_IDS.find((id) => canAccess(id, profile)) ?? 'home';
}

/**
 * Drop anything not on the grantable list.
 *
 * Applied to whatever the form posts, so 'users', 'audit' and invented strings
 * cannot be written into somebody's permissions array even by a request that
 * never went near the UI.
 */
export function sanitizePermissions(input: unknown, role?: Role): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const value of input) {
    const id = String(value ?? '').trim();
    if (!GRANTABLE_IDS.has(id)) continue;
    if (role === 'sales_agent' && !SALES_AGENT_MODULES.has(id)) continue;
    seen.add(id);
  }
  return Array.from(seen);
}

/* ----------------------------------------------------------- the tier ------ */

export const MAX_TIER_DEPTH = 2;
export const DEFAULT_SUB_USER_CAP = 5;

export const subUserCapFor = (p: AdminProfile): number => {
  const cap = Number(p.sub_user_cap);
  return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_SUB_USER_CAP;
};

export const childrenOf = (p: AdminProfile, all: AdminProfile[]): AdminProfile[] =>
  all.filter((c) => c.parent_user_id === p.id && isSubUser(c));

export const subUserSpotsUsed = (p: AdminProfile, all: AdminProfile[]): number =>
  childrenOf(p, all).filter(isActive).length;

export interface Verdict { ok: boolean; reason: string | null }

const no = (reason: string): Verdict => ({ ok: false, reason });
const yes: Verdict = { ok: true, reason: null };

/**
 * May this person invite a sub-user?
 *
 * A sub-user always gets no, which is the API half of the two-level cap: no
 * third level is reachable even by a hand-built request.
 */
export function canInviteSubUser(inviter: AdminProfile | null, all: AdminProfile[]): Verdict {
  if (!inviter) return no('Sign in again.');
  if (!isActive(inviter)) return no('Your account is not active, so you cannot invite anyone.');
  if (isSubUser(inviter)) {
    return no('Sub-users cannot invite sub-users of their own. Only two levels are allowed.');
  }

  const cap = subUserCapFor(inviter);
  if (subUserSpotsUsed(inviter, all) >= cap) {
    return no(`All ${cap} of your sub-user places are taken. Ask an owner to raise your limit.`);
  }
  return yes;
}

/** Is this a valid supervisor for a sub-user? Mirrors the database trigger. */
export function validateSupervisor(parent: AdminProfile | null | undefined): Verdict {
  if (!parent) return no('Choose the staff member who will supervise them.');
  if (isSubUser(parent)) {
    return no('A sub-user cannot supervise anyone. Only two levels are allowed.');
  }
  if (!isActive(parent)) return no('That staff member is not active, so they cannot supervise anyone.');
  return yes;
}

/** The other direction: may this person be turned into a sub-user? */
export function canBecomeSubUser(profile: AdminProfile, all: AdminProfile[]): Verdict {
  if (profile.is_superadmin) return no('A super admin cannot be a sub-user.');

  const children = all.filter((c) => c.parent_user_id === profile.id);
  if (children.length > 0) {
    return no(`They supervise ${children.length} sub-user(s), so they cannot become one.`);
  }
  return yes;
}

/** Move a sub-user to a different supervisor. */
export function validateReassignment(
  subUser: AdminProfile,
  newParent: AdminProfile | null | undefined,
  all: AdminProfile[]
): Verdict {
  if (!isSubUser(subUser)) return no('That person is staff, not a sub-user.');
  if (!newParent) return no('Choose who will take them on.');
  if (newParent.id === subUser.id) return no('Nobody can supervise themselves.');
  if (newParent.id === subUser.parent_user_id) return no('They are already on that person’s team.');

  const supervisor = validateSupervisor(newParent);
  if (!supervisor.ok) return supervisor;

  const cap = subUserCapFor(newParent);
  if (subUserSpotsUsed(newParent, all) >= cap) {
    return no(`${newParent.full_name || 'That staff member'} has used all ${cap} places. Raise their limit first.`);
  }
  return yes;
}

/* ------------------------------------------------- escalation guardrails --- */

/** Fields only an owner may ever write, on anybody. */
export const OWNER_ONLY_FIELDS = [
  'tier', 'role', 'status', 'is_superadmin', 'permissions',
  'parent_user_id', 'sub_user_cap', 'commission_rate', 'override_rate',
] as const;

/**
 * Fields nobody may change on their own account, owner included.
 *
 * Not paranoia about the owner: it stops the one-click mistake that leaves a
 * business with no owner and no way back except the SQL editor. Another owner
 * can always make the change.
 */
export const SELF_PROTECTED_FIELDS = [
  'tier', 'role', 'status', 'is_superadmin', 'permissions', 'parent_user_id',
] as const;

export function guardSelfEdit(
  actorId: string,
  targetId: string,
  changes: Record<string, unknown>
): Verdict {
  if (actorId !== targetId) return yes;

  const blocked = SELF_PROTECTED_FIELDS.filter((f) => f in changes);
  if (blocked.length === 0) return yes;

  return no(
    `You cannot change your own ${blocked.map((f) => f.replace(/_/g, ' ')).join(', ')}. ` +
    'Another owner has to do it.'
  );
}

/** Rate as a number, or null when it is not a usable percentage. */
export function parseRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}
