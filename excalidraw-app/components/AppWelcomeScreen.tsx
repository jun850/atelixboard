import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

export const AppWelcomeScreen: React.FC<{
  onTemplatesOpen: () => void;
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
}> = React.memo((props) => {
  const { t } = useI18n();
  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo>
          <span className="boardy-editor-brand">
            <span className="boardy-editor-brand__name">Boardy</span>
            <span className="boardy-editor-brand__byline">
              By
              <img
                src="/atelix-horizontal.png"
                alt=""
                width="6900"
                height="1500"
              />
            </span>
          </span>
        </WelcomeScreen.Center.Logo>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItem onSelect={props.onTemplatesOpen}>
            Explore templates
          </WelcomeScreen.Center.MenuItem>
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
