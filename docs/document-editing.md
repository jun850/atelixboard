# Document editing

Boardy documents are canvas embeddables backed by immutable file revisions. PDF, DOCX, and legacy DOC uploads are accepted up to 50 MB.

## Local demo

1. Start ONLYOFFICE Community Edition:

   ```sh
   docker compose up -d onlyoffice
   ```

2. Start Boardy:

   ```sh
   VITE_APP_PORT=3000 corepack yarn start
   ```

3. Open `http://localhost:3000/app?localDemo=1` to use the development-only local session, choose **More tools → Insert document**, and select a file from `test-files/documents/`.

Documents are inserted at an A4 canvas ratio (595 × 842 scene units) and render their first page immediately. PDF files use Boardy's page renderer and pen annotation controls; saving creates an annotated PDF revision. The local page-rendering endpoint uses Poppler's `pdftocairo`, which must be installed on the development machine. DOC and DOCX files use a compact ONLYOFFICE editor with nonessential chat, plugin, help, feedback, ruler, and formatting chrome disabled. Saving in ONLYOFFICE creates a new immutable local revision.

ONLYOFFICE Community Edition does not include its white-label controls. Its product mark therefore remains visible for Word documents; do not hide it with CSS or overlays. Replacing or removing that mark requires an eligible ONLYOFFICE Developer license.

The Vite-only bridge stores bytes in `.boardy-documents/`, which is ignored by Git. Production must implement the same endpoints with authenticated server code, use an isolated and resource-limited PDF conversion worker, use the `board-documents` private Supabase bucket, and keep the `DOCUMENT_SERVER_JWT_SECRET` out of the browser. The migration intentionally does not grant clients direct write access to immutable revision rows or files.

ONLYOFFICE Community Edition is AGPL software with product-specific additional terms. Review its license, attribution, and source-code obligations before a hosted release.
