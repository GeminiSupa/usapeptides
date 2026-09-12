import 'server-only';

/**
 * Which permission each admin route needs.
 *
 * Default-deny by shape: a path under /api/admin that matches nothing here
 * needs the owner role, so a route added later is locked until somebody
 * deliberately lists it. The alternative default — open — means every new
 * endpoint is a hole until noticed.
 */

interface Rule {
  pattern: RegExp;
  /** Any one of these is enough. */
  permissions: string[];
}

const RULES: Rule[] = [
  { pattern: /^\/api\/admin\/summary$/,                permissions: ['home'] },
  { pattern: /^\/api\/admin\/banners(?:\/|$)/,         permissions: ['storefront'] },
  { pattern: /^\/api\/admin\/upload(?:\/|$)/,          permissions: ['products', 'storefront', 'users'] },

  { pattern: /^\/api\/admin\/users(?:\/|$)/,           permissions: ['users'] },
  // Inviting and listing your own sub-users needs only my_team; approving,
  // suspending and reassigning them is handled by the owner-only users route.
  { pattern: /^\/api\/admin\/sub-users(?:\/|$)/,       permissions: ['users', 'my_team'] },
  { pattern: /^\/api\/admin\/audit(?:\/|$)/,           permissions: ['audit'] },

  // The generic resource route. The resource name is the permission, which is
  // why the two lists share their names.
  { pattern: /^\/api\/admin\/orders(?:\/|$)/,          permissions: ['orders'] },
  { pattern: /^\/api\/admin\/fulfillment(?:\/|$)/,     permissions: ['fulfillment'] },
  { pattern: /^\/api\/admin\/products(?:\/|$)/,        permissions: ['products'] },
  { pattern: /^\/api\/admin\/deals(?:\/|$)/,           permissions: ['deals'] },
  { pattern: /^\/api\/admin\/customers(?:\/|$)/,       permissions: ['customers'] },
  { pattern: /^\/api\/admin\/inquiries(?:\/|$)/,       permissions: ['inquiries'] },
  { pattern: /^\/api\/admin\/reviews(?:\/|$)/,         permissions: ['reviews'] },
  { pattern: /^\/api\/admin\/carts(?:\/|$)/,           permissions: ['carts'] },
  { pattern: /^\/api\/admin\/leads(?:\/|$)/,           permissions: ['leads'] },
  { pattern: /^\/api\/admin\/prospects(?:\/|$)/,       permissions: ['prospects'] },
  { pattern: /^\/api\/admin\/affiliates(?:\/|$)/,      permissions: ['affiliates'] },
  { pattern: /^\/api\/admin\/commissions(?:\/|$)/,     permissions: ['commissions'] },
  { pattern: /^\/api\/admin\/campaigns(?:\/|$)/,       permissions: ['campaigns'] },
  { pattern: /^\/api\/admin\/subscribers(?:\/|$)/,     permissions: ['subscribers'] },
  { pattern: /^\/api\/admin\/notifications(?:\/|$)/,   permissions: ['notifications'] },
  { pattern: /^\/api\/admin\/activity(?:\/|$)/,        permissions: ['activity'] },

  // Staff records live under the Users umbrella, so they are owner business.
  { pattern: /^\/api\/admin\/team(?:\/|$)/,            permissions: ['users'] },
];

/**
 * The permissions a path needs. An empty array means no rule matched, which
 * callers must treat as owner-only rather than as "no permission needed".
 */
export function permissionsForPath(pathname: string): string[] {
  return RULES.find((r) => r.pattern.test(pathname))?.permissions ?? [];
}
