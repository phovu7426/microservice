export interface PostCommentCreatedEvent {
  comment_id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  parent_comment_user_id: string | null;
}

export const POST_COMMENT_CREATED_TOPIC = 'post.comment.created';
