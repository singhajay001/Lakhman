import { Config } from '@remotion/cli/config';

/**
 * Deterministic composition (section 16). Every setting here exists so that the same props
 * produce the same bytes: no image format negotiation, no concurrency-dependent frame order.
 */
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setOverwriteOutput(true);
// The environment's pre-installed headless shell. Remotion launches with the old headless
// flags, which the full Chrome binary no longer accepts.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER_EXECUTABLE ??
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
);
