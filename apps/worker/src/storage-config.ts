const DEFAULT_STORAGE_LOCAL_DIR = "./storage/captures";

export function getStorageLocalDir(): string {
  const dir = process.env.STORAGE_LOCAL_DIR?.trim();
  return dir && dir.length > 0 ? dir : DEFAULT_STORAGE_LOCAL_DIR;
}
