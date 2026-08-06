/** IndexedDB store for resume blobs attached to the parse review queue. */

const DB_NAME = 'skillnix_resume_files_v1';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveResumeFile(id, file) {
  if (!id || !file) return;
  const buffer = await file.arrayBuffer();
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id,
      name: file.name,
      type: file.type || 'application/octet-stream',
      buffer,
    }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getResumeFile(id) {
  if (!id) return null;
  const db = await openDb();
  const rec = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!rec?.buffer) return null;
  return {
    blob: new Blob([rec.buffer], { type: rec.type || 'application/octet-stream' }),
    name: rec.name || 'resume',
    type: rec.type || 'application/octet-stream',
  };
}

export async function deleteResumeFiles(ids = []) {
  if (!ids.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearResumeFiles() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function openResumeFile(id, { download = false } = {}) {
  const file = await getResumeFile(id);
  if (!file) return false;
  const url = URL.createObjectURL(file.blob);
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return true;
}
