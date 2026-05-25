import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  format: "esm",
  target: "chrome114",
  sourcemap: true,
  logLevel: "info"
};

const configs = [
  {
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js"
  },
  {
    entryPoints: ["src/ui/sidepanel.ts"],
    outfile: "dist/sidepanel.js"
  }
];

async function run() {
  if (watch) {
    const contexts = await Promise.all(configs.map((config) => context({ ...common, ...config })));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log(`Watching ${contexts.length} build targets...`);
    return;
  }

  await Promise.all(configs.map((config) => build({ ...common, ...config })));
  console.log("Build complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
