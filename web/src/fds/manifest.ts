// The shipped FDS runs' summary (written by scripts/fds-manifest.ts after scripts/fds/run.sh), bundled so the
// scripted review and the report can quote real FDS numbers synchronously.
import raw from '../../public/data/fds/apollo-cm012/manifest.json'
import type { FdsManifest } from './load'

export const FDS_MANIFEST = raw as unknown as FdsManifest
export const fdsCase = (id: '1g' | 'ug') => FDS_MANIFEST.cases.find((c) => c.id === id)
