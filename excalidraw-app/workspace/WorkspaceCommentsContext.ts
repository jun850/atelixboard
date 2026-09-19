import { createContext } from "react";

import type { WorkspaceMember } from "./types";

export type WorkspaceCommentsContextValue = {
  sceneId: string;
  members: WorkspaceMember[];
};

export const WorkspaceCommentsContext =
  createContext<WorkspaceCommentsContextValue | null>(null);
