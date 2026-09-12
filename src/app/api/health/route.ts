import { BUSINESS, features, featureRequirements } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Deployment self-check. Reports which integrations are configured without
 * ever echoing a credential value — only whether one is present.
 */
export async function GET() {
  const configured = Object.entries(features).map(([name, enabled]) => ({
    feature: name,
    enabled,
    requires: featureRequirements[name as keyof typeof featureRequirements],
  }));

  return Response.json({
    data: {
      business: BUSINESS.name,
      status: features.database ? 'ok' : 'degraded',
      time: new Date().toISOString(),
      features: configured,
    },
  });
}
