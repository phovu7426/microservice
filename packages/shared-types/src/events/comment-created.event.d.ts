export interface CommentCreatedEvent {
    comment_id: string;
    chapter_id: string;
    user_id: string;
    parent_comment_id: string | null;
}
export declare const COMMENT_CREATED_TOPIC = "comic.comment.created";
