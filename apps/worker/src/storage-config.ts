import { getStorageLocalDir as getConfiguredStorageLocalDir } from "@memory-archive/storage";

export function getStorageLocalDir(): string {
  return getConfiguredStorageLocalDir();
}
