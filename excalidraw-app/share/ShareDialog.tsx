import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  copyIcon,
  LinkIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  share,
  shareIOS,
  shareWindows,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useCopyStatus } from "@excalidraw/excalidraw/hooks/useCopiedIndicator";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS, getFrame } from "@excalidraw/common";
import { useEffect, useRef, useState } from "react";

import { atom, useAtom, useAtomValue } from "../app-jotai";
import { activeRoomLinkAtom } from "../collab/Collab";
import { loadWorkspace, workspaceApi } from "../workspace/api";

import "./ShareDialog.scss";
import { QRCode } from "./QRCode";

import type { CollabAPI } from "../collab/Collab";
import type { FormEvent } from "react";

type OnExportToBackend = () => void;
type ShareDialogType = "share" | "collaborationOnly";

const BoardyBoardShare = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<{
    workspaceId: string;
    sceneId: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "commenter" | "viewer">("editor");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView;
    const sceneId = ownerWindow?.location.pathname.match(
      /^\/app\/boards\/([0-9a-f-]+)$/i,
    )?.[1];
    if (!sceneId) {
      return;
    }
    void loadWorkspace()
      .then((dashboard) =>
        setContext({ workspaceId: dashboard.workspace.id, sceneId }),
      )
      .catch(() => setContext(null));
  }, []);

  if (!context) {
    return <div ref={rootRef} />;
  }

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const result = await workspaceApi<{ token: string }>(
        "invitations",
        "POST",
        {
          workspaceId: context.workspaceId,
          sceneId: context.sceneId,
          recipientEmail: email,
          workspaceRole: "external",
          resourceRole: role,
          maxUses: 1,
        },
      );
      const ownerWindow = event.currentTarget.ownerDocument.defaultView;
      setLink(`${ownerWindow?.location.origin || ""}/invite/${result.token}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Invitation could not be created.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ShareDialog__boardy" ref={rootRef}>
      <div className="ShareDialog__separator">
        <span>Board access</span>
      </div>
      <div className="ShareDialog__picker__header">
        Invite to this whiteboard
      </div>
      <div className="ShareDialog__picker__description">
        Choose exactly what this person can do. They can register from the
        invitation without purchasing a subscription.
      </div>
      <form onSubmit={(event) => void createInvite(event)}>
        <label>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Permission</span>
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "editor" | "commenter" | "viewer")
            }
          >
            <option value="editor">Editor</option>
            <option value="commenter">Commenter</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <button
          className="ShareDialog__boardy__submit"
          type="submit"
          disabled={creating}
        >
          {creating ? "Creating invitation…" : "Create invitation"}
        </button>
      </form>
      {error && (
        <p className="ShareDialog__boardy__error" role="alert">
          {error}
        </p>
      )}
      {link && (
        <div className="ShareDialog__boardy__link">
          <input aria-label="Invitation link" readOnly value={link} />
          <button
            type="button"
            onClick={(event) =>
              void event.currentTarget.ownerDocument.defaultView?.navigator.clipboard.writeText(
                link,
              )
            }
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
};

export const shareDialogStateAtom = atom<
  { isOpen: false } | { isOpen: true; type: ShareDialogType }
>({ isOpen: false });

const getShareIcon = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return shareIOS;
  } else if (isWindowsBrowser) {
    return shareWindows;
  }

  return share;
};

export type ShareDialogProps = {
  collabAPI: CollabAPI | null;
  handleClose: () => void;
  onExportToBackend: OnExportToBackend;
  type: ShareDialogType;
};

const ActiveRoomDialog = ({
  collabAPI,
  activeRoomLink,
  handleClose,
}: {
  collabAPI: CollabAPI;
  activeRoomLink: string;
  handleClose: () => void;
}) => {
  const { t } = useI18n();
  const [, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);
  const isShareSupported = "share" in navigator;
  const { onCopy, copyStatus } = useCopyStatus();

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (e) {
      collabAPI.setCollabError(t("errors.copyToSystemClipboardFailed"));
    }

    setJustCopied(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustCopied(false);
    }, 3000);

    ref.current?.select();
  };

  const shareRoomLink = async () => {
    try {
      await navigator.share({
        title: t("roomDialog.shareTitle"),
        text: t("roomDialog.shareTitle"),
        url: activeRoomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  return (
    <>
      <h3 className="ShareDialog__active__header">
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </h3>
      <TextField
        defaultValue={collabAPI.getUsername()}
        placeholder="Your name"
        label="Your name"
        onChange={collabAPI.setUsername}
        onKeyDown={(event) => event.key === KEYS.ENTER && handleClose()}
      />
      <div className="ShareDialog__active__linkRow">
        <TextField
          ref={ref}
          label="Link"
          readonly
          fullWidth
          value={activeRoomLink}
        />
        {isShareSupported && (
          <FilledButton
            size="large"
            variant="icon"
            label="Share"
            icon={getShareIcon()}
            className="ShareDialog__active__share"
            onClick={shareRoomLink}
          />
        )}
        <FilledButton
          size="large"
          label={t("buttons.copyLink")}
          icon={copyIcon}
          status={copyStatus}
          onClick={() => {
            copyRoomLink();
            onCopy();
          }}
        />
      </div>
      <QRCode value={activeRoomLink} />
      <div className="ShareDialog__active__description">
        <p>
          <span
            role="img"
            aria-hidden="true"
            className="ShareDialog__active__description__emoji"
          >
            🔒{" "}
          </span>
          {t("roomDialog.desc_privacy")}
        </p>
        <p>{t("roomDialog.desc_exitSession")}</p>
      </div>

      <div className="ShareDialog__active__actions">
        <FilledButton
          size="large"
          variant="outlined"
          color="danger"
          label={t("roomDialog.button_stopSession")}
          icon={playerStopFilledIcon}
          onClick={() => {
            trackEvent("share", "room closed");
            collabAPI.stopCollaboration();
            if (!collabAPI.isCollaborating()) {
              handleClose();
            }
          }}
        />
      </div>
    </>
  );
};

const ShareDialogPicker = (props: ShareDialogProps) => {
  const { t } = useI18n();

  const { collabAPI } = props;

  const startCollabJSX = collabAPI ? (
    <>
      <div className="ShareDialog__picker__header">
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </div>

      <div className="ShareDialog__picker__description">
        <div style={{ marginBottom: "1em" }}>{t("roomDialog.desc_intro")}</div>
        {t("roomDialog.desc_privacy")}
      </div>

      <div className="ShareDialog__picker__button">
        <FilledButton
          size="large"
          label={t("roomDialog.button_startSession")}
          icon={playerPlayIcon}
          onClick={() => {
            trackEvent("share", "room creation", `ui (${getFrame()})`);
            collabAPI.startCollaboration(null);
          }}
        />
      </div>

      {props.type === "share" && (
        <div className="ShareDialog__separator">
          <span>{t("shareDialog.or")}</span>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {startCollabJSX}

      {props.type === "share" && (
        <>
          <div className="ShareDialog__picker__header">
            {t("exportDialog.link_title")}
          </div>
          <div className="ShareDialog__picker__description">
            {t("exportDialog.link_details")}
          </div>

          <div className="ShareDialog__picker__button">
            <FilledButton
              size="large"
              label={t("exportDialog.link_button")}
              icon={LinkIcon}
              onClick={async () => {
                await props.onExportToBackend();
                props.handleClose();
              }}
            />
          </div>
        </>
      )}
    </>
  );
};

const ShareDialogInner = (props: ShareDialogProps) => {
  const activeRoomLink = useAtomValue(activeRoomLinkAtom);

  return (
    <Dialog size="small" onCloseRequest={props.handleClose} title={false}>
      <div className="ShareDialog">
        {props.collabAPI && activeRoomLink ? (
          <ActiveRoomDialog
            collabAPI={props.collabAPI}
            activeRoomLink={activeRoomLink}
            handleClose={props.handleClose}
          />
        ) : (
          <ShareDialogPicker {...props} />
        )}
        <BoardyBoardShare />
      </div>
    </Dialog>
  );
};

export const ShareDialog = (props: {
  collabAPI: CollabAPI | null;
  onExportToBackend: OnExportToBackend;
}) => {
  const [shareDialogState, setShareDialogState] = useAtom(shareDialogStateAtom);

  const { openDialog } = useUIAppState();

  useEffect(() => {
    if (openDialog) {
      setShareDialogState({ isOpen: false });
    }
  }, [openDialog, setShareDialogState]);

  if (!shareDialogState.isOpen) {
    return null;
  }

  return (
    <ShareDialogInner
      handleClose={() => setShareDialogState({ isOpen: false })}
      collabAPI={props.collabAPI}
      onExportToBackend={props.onExportToBackend}
      type={shareDialogState.type}
    />
  );
};
