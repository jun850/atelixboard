import { useEffect, useMemo, useRef, useState } from "react";

import { uploadCommentImage } from "./api";
import { useProAccess } from "./ProAccess";

import type { KeyboardEvent } from "react";
import type { CommentMention, WorkspaceMember } from "./types";

const emojiOptions = ["😀", "👍", "❤️", "🎉", "🤔", "👀"];

const SendIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 19V5m0 0-6 6m6-6 6 6" />
  </svg>
);

export const CommentComposer = ({
  sceneId,
  members,
  placeholder,
  onSubmit,
  autoFocus = false,
}: {
  sceneId: string;
  members: WorkspaceMember[];
  placeholder: string;
  onSubmit: (
    message: string,
    mentions: CommentMention[],
    attachmentAssetId?: string,
  ) => Promise<void>;
  autoFocus?: boolean;
}) => {
  const { isPro, requirePro } = useProAccess();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [mentions, setMentions] = useState<CommentMention[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [activeMention, setActiveMention] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const mentionMatch = message
    .slice(0, textareaRef.current?.selectionStart)
    .match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null;
  const matches = useMemo(
    () =>
      mentionQuery === null
        ? []
        : members
            .filter((member) =>
              `${member.profile.displayName} ${member.profile.email}`
                .toLowerCase()
                .includes(mentionQuery),
            )
            .slice(0, 6),
    [members, mentionQuery],
  );

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const ownerWindow = textareaRef.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    const next = ownerWindow.URL.createObjectURL(file);
    setPreview(next);
    return () => ownerWindow.URL.revokeObjectURL(next);
  }, [file]);

  const chooseMention = (member: WorkspaceMember) => {
    const textarea = textareaRef.current;
    if (!textarea || !mentionMatch) {
      return;
    }
    const caret = textarea.selectionStart;
    const matchStart = caret - mentionMatch[0].length;
    const leadingSpace = mentionMatch[0].startsWith(" ") ? " " : "";
    const displayText = `@${member.profile.displayName}`;
    const next = `${message.slice(
      0,
      matchStart,
    )}${leadingSpace}${displayText} ${message.slice(caret)}`;
    setMessage(next);
    setMentions((current) => [
      ...current.filter((item) => item.userId !== member.user_id),
      { userId: member.user_id, displayText },
    ]);
    setActiveMention(0);
    const nextCaret = matchStart + leadingSpace.length + displayText.length + 1;
    textarea.ownerDocument.defaultView?.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const submit = async () => {
    if (submitting) {
      return;
    }
    if (
      !requirePro(
        "comment",
        textareaRef.current?.ownerDocument.defaultView || null,
      )
    ) {
      return;
    }
    if (!message.trim() && !file) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const attachmentAssetId = file
        ? await uploadCommentImage(sceneId, file)
        : undefined;
      await onSubmit(message.trim(), mentions, attachmentAssetId);
      setMessage("");
      setMentions([]);
      setFile(null);
      setEmojiOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Comment could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMention((current) =>
          event.key === "ArrowDown"
            ? (current + 1) % matches.length
            : (current - 1 + matches.length) % matches.length,
        );
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chooseMention(matches[activeMention]);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape") {
      setEmojiOpen(false);
    }
  };

  return (
    <div className="boardy-comment-composer">
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        rows={2}
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setActiveMention(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {mentionQuery !== null && (
        <div
          className="boardy-mention-results"
          role="listbox"
          aria-label="Teammates"
        >
          {matches.length ? (
            matches.map((member, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeMention}
                className={index === activeMention ? "is-active" : ""}
                key={member.user_id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseMention(member)}
              >
                <span className="boardy-comment-avatar">
                  {member.profile.avatarUrl ? (
                    <img src={member.profile.avatarUrl} alt="" />
                  ) : (
                    member.profile.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span>
                  <strong>{member.profile.displayName}</strong>
                  <small>{member.profile.email}</small>
                </span>
              </button>
            ))
          ) : (
            <p>No matches for @{mentionQuery}</p>
          )}
        </div>
      )}
      {preview && (
        <div className="boardy-comment-attachment-preview">
          <img src={preview} alt="Comment attachment preview" />
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      )}
      {mentions.length > 0 && (
        <div
          className="boardy-comment-mentioned"
          aria-label="Mentioned teammates"
        >
          {mentions.map((mention) => (
            <span key={mention.userId}>{mention.displayText}</span>
          ))}
        </div>
      )}
      <div className="boardy-comment-composer__actions">
        <div>
          <button
            type="button"
            aria-label="Add emoji"
            title="Emoji"
            onClick={() => setEmojiOpen((open) => !open)}
          >
            ☺
          </button>
          <button
            type="button"
            aria-label="Mention teammate"
            title="Mention"
            onClick={() => {
              setMessage(
                (value) =>
                  `${value}${value && !value.endsWith(" ") ? " " : ""}@`,
              );
              textareaRef.current?.focus();
            }}
          >
            @
          </button>
          <button
            type="button"
            aria-label="Attach image"
            title="Attach image"
            onClick={() => fileRef.current?.click()}
          >
            ▧
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const next = event.target.files?.[0] || null;
              if (
                next &&
                (next.size > 5 * 1024 * 1024 ||
                  ![
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "image/gif",
                  ].includes(next.type))
              ) {
                setError("Choose a PNG, JPEG, WebP, or GIF up to 5 MB.");
                event.target.value = "";
                return;
              }
              setError("");
              setFile(next);
            }}
          />
        </div>
        <div className="boardy-comment-composer__submit">
          {!isPro && <span className="boardy-pro-tag">Pro</span>}
          <button
            type="button"
            className="boardy-comment-send"
            aria-label="Send comment"
            title="Send comment"
            disabled={submitting || (isPro && !message.trim() && !file)}
            onClick={() => void submit()}
          >
            <SendIcon />
          </button>
        </div>
      </div>
      {emojiOpen && (
        <div className="boardy-emoji-picker" aria-label="Choose an emoji">
          {emojiOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setMessage((value) => `${value}${emoji}`);
                setEmojiOpen(false);
                textareaRef.current?.focus();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="boardy-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
