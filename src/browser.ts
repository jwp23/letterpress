export interface BrowserCommand {
  cmd: string;
  args: string[];
}

/** Chromium-family binaries that accept --app for a chromeless window, in preference order. */
const APP_MODE_BROWSERS = [
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
  'brave',
  'brave-browser',
];

/** Picks the command that opens url: app mode when a Chromium-family browser exists, else xdg-open. */
export function browserCommand(url: string, isAvailable: (cmd: string) => boolean): BrowserCommand {
  const cmd = APP_MODE_BROWSERS.find(isAvailable);
  return cmd ? { cmd, args: [`--app=${url}`] } : { cmd: 'xdg-open', args: [url] };
}
