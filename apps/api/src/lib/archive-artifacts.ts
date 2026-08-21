import { ArchiveArtifactStore, getStorageLocalDir, LocalStorageAdapter } from "@memory-archive/storage";

let archiveArtifactStore: ArchiveArtifactStore | undefined;

export type PublicArchiveCapture = {
  editorialStatus: string;
  captureStatus: string;
  artifactKey: string | null;
};

export function canServePublicArchiveCapture(
  capture: PublicArchiveCapture
): capture is PublicArchiveCapture & { artifactKey: string } {
  return (
    capture.editorialStatus === "PUBLISHED" &&
    capture.captureStatus === "SUCCEEDED" &&
    typeof capture.artifactKey === "string" &&
    capture.artifactKey.length > 0
  );
}

export function archiveArtifactPath(captureId: string) {
  return `/api/archive/captures/${encodeURIComponent(captureId)}`;
}

export function getArchiveArtifactStore() {
  archiveArtifactStore ??= new ArchiveArtifactStore(new LocalStorageAdapter(getStorageLocalDir()));
  return archiveArtifactStore;
}
