import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function parseArgs(args) {
  let version;
  let targetDir;
  let versionFromOption = false;
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--version" || arg === "-v") {
      version = args[i + 1];
      versionFromOption = true;
      i += 1;
      continue;
    }

    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      versionFromOption = true;
      continue;
    }

    if (arg === "--out" || arg === "--output" || arg === "--target-dir") {
      targetDir = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      targetDir = arg.slice("--out=".length);
      continue;
    }

    if (arg.startsWith("--output=")) {
      targetDir = arg.slice("--output=".length);
      continue;
    }

    if (arg.startsWith("--target-dir=")) {
      targetDir = arg.slice("--target-dir=".length);
      continue;
    }

    positional.push(arg);
  }

  if (!version) {
    version = positional[0];
    targetDir ??= positional[1];
  } else if (versionFromOption) {
    targetDir ??= positional[0];
  } else {
    targetDir ??= positional[1];
  }

  return { version, targetDir };
}

function readProjectName() {
  const configPath = resolve("project/config.ts");
  const config = existsSync(configPath) ? String(require("node:fs").readFileSync(configPath)) : "";
  const match = config.match(/ProjectName\s*=\s*["']([^"']+)["']/);
  return match?.[1] ?? "spicy-lyrics";
}

function getBuiltJsFile(distDir, projectName) {
  const preferred = join(distDir, `${projectName}.js`);
  if (existsSync(preferred)) return preferred;

  const files = readdirSync(distDir).filter((file) => file.endsWith(".js"));
  if (files.length === 1) return join(distDir, files[0]);

  throw new Error(`Could not find built JS output in ${distDir}`);
}

const { version, targetDir } = parseArgs(process.argv.slice(2));
if (!version) {
  console.error("Usage: bun run build --version <version> [outputDir]");
  console.error("   or: node project/build.mjs --version <version> [outputDir]");
  process.exit(1);
}

const projectName = readProjectName();
const defaultDist = resolve("dist");
const outputFile = `${projectName}@${version}.mjs`;
const creatorBin = require.resolve("@spicemod/creator/bin");

const result = spawnSync(process.execPath, [creatorBin, "build", "--no-copy"], {
  cwd: resolve("."),
  env: {
    ...process.env,
    SPICY_LYRICS_BUILD_VERSION: version,
  },
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

try {
  const builtFile = getBuiltJsFile(defaultDist, projectName);
  const versionedOutput = join(defaultDist, outputFile);
  copyFileSync(builtFile, versionedOutput);
  writeFileSync(join(defaultDist, "version"), version);

  if (targetDir) {
    const dest = resolve(targetDir);
    mkdirSync(dest, { recursive: true });
    copyFileSync(versionedOutput, join(dest, outputFile));
    writeFileSync(join(dest, "version"), version);
    console.log(`Copied build to ${dest}`);
  }
} catch (error) {
  console.error("Error copying build output:", error);
  process.exit(1);
}
