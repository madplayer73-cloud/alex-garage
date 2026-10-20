import { access, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Keep the built website in Git so CasaOS needs only Git and Docker.
const source = new URL('../dist/', import.meta.url);
const destination = new URL('../deploy/site/', import.meta.url);
await access(new URL('index.html', source));
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log(`CasaOS website prepared: ${fileURLToPath(destination)}`);
