import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";

import {
  normalizeDoc,
  renderDoc,
} from "../../../supabase/functions/_shared/studio-core";

import { studio, type Row } from "./api";

export function ArticleEditor({
  initial,
  onClose,
  onChange,
}: {
  initial: Row;
  onClose: () => void;
  onChange: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = useRef(initial);
  const saving = useRef(false);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const [item, setItem] = useState(initial);
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [link, setLink] = useState("");
  const [image, setImage] = useState("");
  const [alt, setAlt] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false },
      }),
      TableKit,
      Image,
    ],
    content: initial.doc,
    onUpdate: ({ editor }) => {
      dirty.current = true;
      current.current = { ...current.current, doc: editor.getJSON() };
      setStatus("Unsaved changes");
    },
    editorProps: {
      attributes: {
        "aria-label": "Article body",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });
  const edit = (key: string, value: unknown) => {
    current.current = { ...current.current, [key]: value };
    setItem(current.current);
    dirty.current = true;
    setStatus("Unsaved changes");
  };
  async function save() {
    if (saving.current || blocked.current) {
      return false;
    }
    if (!dirty.current) {
      return true;
    }
    saving.current = true;
    setStatus("Saving…");
    const snapshot = { ...current.current };
    dirty.current = false;
    try {
      const { item: next } = await studio({
        action: "save",
        entity: "articles",
        ...snapshot,
      });
      current.current = {
        ...current.current,
        id: next.id,
        version: next.version,
      };
      setItem({ ...current.current });
      setStatus(dirty.current ? "Unsaved changes" : "Saved");
      onChange();
      return !dirty.current;
    } catch (e) {
      dirty.current = true;
      blocked.current = true;
      setError((e as Error).message);
      setStatus("Not saved");
      return false;
    } finally {
      saving.current = false;
    }
  }
  const saveLatest = useRef(save);
  saveLatest.current = save;
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const win = el?.ownerDocument.defaultView;
    const timer = win?.setInterval(() => {
      if (dirty.current) {
        void saveLatest.current();
      }
    }, 2000);
    return () => {
      if (timer) {
        win?.clearInterval(timer);
      }
    };
  }, []);
  const close = async () => {
    if (await save()) {
      onClose();
    }
  };
  const publish = async () => {
    if (!(await save())) {
      return;
    }
    try {
      await studio({
        action: "publish",
        items: [{ id: current.current.id, version: current.current.version }],
      });
      const r = await studio({
        action: "get",
        entity: "articles",
        id: current.current.id,
      });
      current.current = r.item;
      setItem(r.item);
      setStatus("Published");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <dialog
      className="studio-editor"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      aria-labelledby="editor-heading"
    >
      <header>
        <div>
          <h2 id="editor-heading">Edit article</h2>
          <span role="status">{status}</span>
        </div>
        <div className="studio-actions">
          <button onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={async () => {
              setRevisionsOpen(!revisionsOpen);
              try {
                setHistory(
                  (
                    await studio({
                      action: "list",
                      entity: "revisions",
                      id: item.id,
                    })
                  ).rows,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            History
          </button>
          <button className="primary" onClick={() => void publish()}>
            Publish
          </button>
          <button onClick={() => void close()}>Close</button>
        </div>
      </header>
      {error && (
        <div role="alert" className="studio-error">
          {error}{" "}
          <button
            onClick={() => {
              blocked.current = false;
              setError("");
              void saveLatest.current();
            }}
          >
            Retry save
          </button>
          <button onClick={onClose}>Discard unsaved changes</button>
        </div>
      )}
      {revisionsOpen && (
        <section>
          <h3>Revision history</h3>
          {history.length ? (
            history.map((r) => (
              <div key={r.id} className="studio-row">
                Version {r.version} · {new Date(r.created_at).toLocaleString()}{" "}
                <button
                  onClick={() => {
                    const old = r.snapshot;
                    edit("title", old.title);
                    edit("description", old.description);
                    edit("doc", old.doc);
                    editor?.commands.setContent(old.doc);
                  }}
                >
                  Restore as draft
                </button>
              </div>
            ))
          ) : (
            <p>No earlier revisions.</p>
          )}
        </section>
      )}
      <div className="studio-editor-body">
        <label>
          Title
          <input
            value={item.title}
            onChange={(e) => edit("title", e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          Description
          <textarea
            value={item.description}
            onChange={(e) => edit("description", e.target.value)}
            rows={2}
            maxLength={500}
          />
        </label>
        <p className="studio-muted">Public URL: /learn/{item.slug}</p>
        {preview ? (
          <article
            className="studio-preview"
            dangerouslySetInnerHTML={{
              __html: renderDoc(normalizeDoc(current.current.doc)),
            }}
          />
        ) : (
          <>
            <div
              className="studio-editor-tools"
              role="toolbar"
              aria-label="Text formatting"
            >
              <button
                onClick={() => editor?.chain().focus().toggleBold().run()}
                aria-pressed={editor?.isActive("bold")}
              >
                Bold
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                Italic
              </button>
              <button
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
              >
                Heading
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                List
              </button>
              <button
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              >
                Numbered
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                Quote
              </button>
              <button
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                Table
              </button>
              <button
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                Add row
              </button>
              <button
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                Add column
              </button>
              <button
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                Remove table
              </button>
              <button onClick={() => editor?.chain().focus().undo().run()}>
                Undo
              </button>
              <button onClick={() => editor?.chain().focus().redo().run()}>
                Redo
              </button>
            </div>
            <EditorContent editor={editor} />
            <details>
              <summary>Links and images</summary>
              <div className="studio-actions">
                <label>
                  Link URL
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <button
                  onClick={() => {
                    if (/^https:\/\//.test(link)) {
                      editor?.chain().focus().setLink({ href: link }).run();
                    }
                  }}
                >
                  Apply link
                </button>
                <button
                  onClick={() => editor?.chain().focus().unsetLink().run()}
                >
                  Remove link
                </button>
              </div>
              <div className="studio-actions">
                <label>
                  Boardy image URL
                  <input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://boardy.sbs/…"
                  />
                </label>
                <label>
                  Alt text
                  <input value={alt} onChange={(e) => setAlt(e.target.value)} />
                </label>
                <button
                  onClick={() => {
                    try {
                      normalizeDoc({
                        type: "doc",
                        content: [
                          { type: "image", attrs: { src: image, alt } },
                        ],
                      });
                      editor
                        ?.chain()
                        .focus()
                        .setImage({ src: image, alt })
                        .run();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Insert image
                </button>
              </div>
            </details>
          </>
        )}
        <section>
          <h3>Editorial review</h3>
          <p>
            Check this saved draft against approved product knowledge.
            Suggestions arrive in the job queue and never overwrite your edits.
          </p>
          <button
            onClick={async () => {
              if (!(await save())) {
                return;
              }
              try {
                const win = dialog.current?.ownerDocument.defaultView;
                await studio({
                  action: "enqueue",
                  kind: "review",
                  articleId: current.current.id,
                  requestKey: win?.crypto.randomUUID(),
                });
                setStatus("Review queued");
                onChange();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Review with Codex
          </button>
        </section>
      </div>
    </dialog>
  );
}
