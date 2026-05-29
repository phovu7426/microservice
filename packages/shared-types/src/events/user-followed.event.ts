export interface UserFollowedComicEvent {
  user_id: string;
  comic_id: string;
  followed_at: string;
}

export interface UserUnfollowedComicEvent {
  user_id: string;
  comic_id: string;
}

export const USER_FOLLOWED_COMIC_TOPIC = 'user.followed.comic';
export const USER_UNFOLLOWED_COMIC_TOPIC = 'user.unfollowed.comic';
