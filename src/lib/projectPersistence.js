// The only module that knows how the project is actually laid out in
// IndexedDB. Everything else (the persistence hook, the store) deals
// in plain {tracks, assets} shapes and never touches idbGet/idbPut
// directly - see indexedDb.js for the generic primitives this is built on.
//
// Schema:
//   project store   - one record, key "current": { tracks, assets: [metadata] }
//   assetBlobs store - one Blob per asset, keyed by assetId
//
// Deliberately NOT stored in the project record: blob URLs
// (`blob:http://...`) - they're only valid for the browser session
// that created them and are meaningless after a reload - and the raw
// Blob/File itself, which lives in its own store instead of being
// duplicated inline in the structural record.
import { idbGet, idbPut, idbDelete, idbClear } from './indexedDb';

const PROJECT_STORE = 'project';
const ASSET_BLOB_STORE = 'assetBlobs';
const PROJECT_KEY = 'current'; // single-project app - no project-switching UI, so one fixed slot is enough

const ASSET_METADATA_FIELDS = ['id', 'name', 'type', 'duration', 'width', 'height'];

function toMetadata(asset) {
  const metadata = {};
  for (const field of ASSET_METADATA_FIELDS) metadata[field] = asset[field];
  return metadata;
}

// Saves project structure only (tracks + asset metadata) - cheap
// enough to call on every debounced edit. Asset binary data is saved
// separately via saveAssetBlob, once, at upload time - re-writing
// potentially large blobs on every drag/trim edit would be wasteful
// and unnecessary, since editing a clip never changes its asset's
// underlying media.
export async function saveProject({ tracks, assets }) {
  await idbPut(PROJECT_STORE, { tracks, assets: assets.map(toMetadata) }, PROJECT_KEY);
}

export async function saveAssetBlob(assetId, blob) {
  await idbPut(ASSET_BLOB_STORE, blob, assetId);
}

export async function deleteAssetBlob(assetId) {
  await idbDelete(ASSET_BLOB_STORE, assetId);
}

// Reconstructs the full in-memory project shape: reads the structural
// record, then for each asset reads its Blob back and creates a FRESH
// object URL for it - object URLs are never stored, only ever
// recreated at load time.
export async function loadProject() {
  const record = await idbGet(PROJECT_STORE, PROJECT_KEY);
  if (!record) return null;

  const assets = [];
  for (const metadata of record.assets ?? []) {
    const blob = await idbGet(ASSET_BLOB_STORE, metadata.id);
    if (!blob) {
      // Metadata was saved but its blob wasn't (e.g. the tab closed
      // between the two writes) - skip this one asset rather than
      // restore something that can't actually play. Clips that
      // reference it fall back to the app's existing "missing asset"
      // handling (Clip.jsx already renders "Missing asset" for this).
      console.warn(`Skipping restore of "${metadata.name}" - its stored media data is missing.`);
      continue;
    }
    assets.push({ ...metadata, blob, src: URL.createObjectURL(blob) });
  }

  return { tracks: record.tracks ?? [], assets };
}

export async function clearPersistedProject() {
  await idbClear(PROJECT_STORE);
  await idbClear(ASSET_BLOB_STORE);
}
