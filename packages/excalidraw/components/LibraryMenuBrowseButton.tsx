import { fileOpen } from "../data/filesystem";

import { useApp, useAppProps, useExcalidrawSetAppState } from "./App";

const LibraryMenuBrowseButton = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const { onLibraryAssetUploadRequested } = useAppProps();

  const upload = async () => {
    if (onLibraryAssetUploadRequested?.() === false) {
      return;
    }
    try {
      const file = await fileOpen({
        description: "Boardy library files",
        extensions: ["excalidrawlib", "json"],
      });
      await app.library.updateLibrary({
        libraryItems: file,
        merge: true,
        openLibraryMenu: true,
      });
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        setAppState({ errorMessage: "Could not upload this library file." });
      }
    }
  };
  return (
    <button
      className="library-menu-browse-button"
      type="button"
      onClick={upload}
      title="Upload a Boardy library file (.excalidrawlib or .json)"
    >
      Upload asset to library <span className="boardy-pro-tag">Pro</span>
    </button>
  );
};

export default LibraryMenuBrowseButton;
