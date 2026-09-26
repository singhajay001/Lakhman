import { createHash } from 'node:crypto';
import type { Platform } from '@spirithaus/domain';

/**
 * The tracked destination (sections 13 and 26).
 *
 * One short opaque parameter carries the campaign identity, and the conventional UTMs
 * sit alongside it so Shopify's own reporting and any analytics tool still work. The
 * UTMs are client-side data — section 26 is explicit that they must not be described as
 * server-side. What is server-side is the recording and the join.
 */
export const PLATFORM_UTM_SOURCE: Record<Platform, string> = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  X: 'x',
  TIKTOK: 'tiktok',
  YOUTUBE: 'youtube',
  PINTEREST: 'pinterest',
};

export interface TrackedLinkInput {
  destination: string;
  platform: Platform;
  campaignId: string;
  campaignSlug: string;
  variantSlug: string;
  paid: boolean;
  offerCode?: string | null;
}

/** A short, stable, opaque campaign code. Short because platforms mangle long URLs. */
export function campaignCode(campaignId: string, platform: Platform): string {
  const digest = createHash('sha256').update(`${campaignId}:${platform}`).digest();
  // 40 bits is ample for one retailer's campaign space and stays 8 characters.
  return BigInt(`0x${digest.subarray(0, 5).toString('hex')}`)
    .toString(36)
    .padStart(8, '0');
}

export function buildTrackedLink(input: TrackedLinkInput): string {
  const url = new URL(input.destination);
  url.searchParams.set('utm_source', PLATFORM_UTM_SOURCE[input.platform]);
  url.searchParams.set('utm_medium', input.paid ? 'social_paid' : 'social_organic');
  url.searchParams.set('utm_campaign', slug(input.campaignSlug));
  url.searchParams.set('utm_content', slug(input.variantSlug));
  url.searchParams.set('sh_c', campaignCode(input.campaignId, input.platform));
  if (input.offerCode) url.searchParams.set('sh_offer', input.offerCode);
  return url.toString();
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Reads our parameters back off a landing URL, for the Phase 5 identity chain. */
export function readTracking(url: string): {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  code?: string;
  offer?: string;
} {
  const parsed = new URL(url);
  const get = (key: string) => parsed.searchParams.get(key) ?? undefined;
  return {
    source: get('utm_source'),
    medium: get('utm_medium'),
    campaign: get('utm_campaign'),
    content: get('utm_content'),
    code: get('sh_c'),
    offer: get('sh_offer'),
  };
}
