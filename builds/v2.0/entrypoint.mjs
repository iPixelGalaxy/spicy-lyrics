// Keep existing Pixel installations on the same fork and branch as this entrypoint.
const entrypoint = new URL("../main/entrypoint.mjs", import.meta.url);
entrypoint.searchParams.set("v", String(Date.now()));
import(entrypoint.href);
