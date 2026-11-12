import { ImageOff } from "lucide-react";

import { API, type FileUrlWidth } from "@/api";
import { useProjectsStore } from "@/stores/projects-store";

export function ProjectThumbnail({ projectName, path, width = 320 }: {
  projectName: string;
  path: string | null | undefined;
  width?: FileUrlWidth;
}) {
  const fingerprint = useProjectsStore((state) => path ? state.assetFingerprints[path] : null);
  return path ? (
    <img src={API.getFileUrl(projectName, path, fingerprint, { width })} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center text-muted-foreground"><ImageOff aria-hidden className="size-4" /></span>
  );
}
