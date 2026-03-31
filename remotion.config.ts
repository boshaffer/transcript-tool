import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.overrideWebpackConfig((currentConfiguration) => {
  return enableTailwind(currentConfiguration);
});

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(true);

// Use locally installed Chrome headless shell if available
const defaultChrome = "/root/.cache/remotion/chrome-headless-shell-linux64/chrome-headless-shell";
const chromePath = process.env.REMOTION_CHROME_EXECUTABLE ||
  (require("fs").existsSync(defaultChrome) ? defaultChrome : undefined);
if (chromePath) {
  Config.setBrowserExecutable(chromePath);
}

Config.setChromiumHeadlessMode("shell");
