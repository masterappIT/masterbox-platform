// The admin's sources import each other without extensions, as webpack allows. Node needs them, so this adds .js
// when a relative import has none. Loaded with `node --import ./test/resolve-extensionless.mjs`.
import { register } from 'node:module';

register('./extensionless-loader.mjs', import.meta.url);
