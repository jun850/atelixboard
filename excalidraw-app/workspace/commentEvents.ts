export const COMMENT_PLACEMENT_EVENT = "boardy:comment-placement";
export const COMMENTS_CHANGED_EVENT = "boardy:comments-changed";

export type CommentPlacementDetail = {
  message: string;
  anchorKind: "point" | "region";
};
