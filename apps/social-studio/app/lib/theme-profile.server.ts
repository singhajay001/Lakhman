import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { err, ok, type Result, type ThemeProfileShape } from '@spirithaus/domain';

/**
 * Locates docs/spirithaus/theme-profile.json.
 *
 * The Brand Kit is seeded from it rather than typed in, which means the app has to find
 * it from whatever directory it was started in — the dev server runs from
 * apps/social-studio, the worker from apps/worker, and the container from the repository
 * root. THEME_PROFILE_PATH overrides. A missing file is reported with every path that was
 * tried, rather than falling back to invented tokens.
 */
const CANDIDATES = [
  'docs/spirithaus/theme-profile.json',
  '../../docs/spirithaus/theme-profile.json',
  '../../../docs/spirithaus/theme-profile.json',
];

export function loadThemeProfile(): Result<{ profile: ThemeProfileShape; path: string }, string> {
  const fromEnv = process.env.THEME_PROFILE_PATH;
  const paths = fromEnv ? [fromEnv, ...CANDIDATES] : CANDIDATES;
  const tried: string[] = [];

  for (const candidate of paths) {
    const path = resolve(process.cwd(), candidate);
    tried.push(path);
    if (!existsSync(path)) continue;
    try {
      const profile = JSON.parse(readFileSync(path, 'utf8')) as ThemeProfileShape;
      if (!profile.tokens?.ink || !profile.tokens?.fontDisplay) {
        return err(
          `${path} does not look like a theme profile: it has no tokens.ink or tokens.fontDisplay.`,
        );
      }
      return ok({ profile, path });
    } catch (error) {
      return err(
        `${path} could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return err(
    `No theme profile found. Set THEME_PROFILE_PATH, or run from a directory where one of these exists:\n${tried.join('\n')}`,
  );
}
