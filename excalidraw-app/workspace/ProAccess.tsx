import { createContext, useContext } from "react";

export type PaidAction =
  | "board"
  | "collection"
  | "template"
  | "assistant"
  | "invite"
  | "comment"
  | "document"
  | "library";

type ProAccess = {
  isPro: boolean;
  requirePro: (action: PaidAction, ownerWindow: Window | null) => boolean;
};

const ProAccessContext = createContext<ProAccess>({
  isPro: false,
  requirePro: () => false,
});

export const ProAccessProvider = ProAccessContext.Provider;
export const useProAccess = () => useContext(ProAccessContext);
