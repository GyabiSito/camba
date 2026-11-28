// Keep only the exact encoded files for crop uploads whose response has not been confirmed.
function withCrops<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('camba-product-photo-crops', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const transaction = db.transaction('files', mode);
        const request = work(transaction.objectStore('files'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      } finally {
        db.close();
      }
    };
  });
}

export function readCroppedPhotos(key: string): Promise<File[] | undefined> {
  return withCrops('readonly', store => store.get(key)).catch(() => undefined);
}

export function keepCroppedPhotos(key: string, files: File[]) {
  return withCrops('readwrite', store => store.put(files, key));
}

export function forgetCroppedPhotos(key: string) {
  return withCrops('readwrite', store => store.delete(key)).catch(() => undefined);
}
