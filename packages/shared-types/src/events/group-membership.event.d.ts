export interface GroupMemberAddedEvent {
    group_id: string;
    user_id: string;
    timestamp: string;
}
export interface GroupMemberRemovedEvent {
    group_id: string;
    user_id: string;
    timestamp: string;
}
export interface GroupDeletedEvent {
    group_id: string;
    timestamp: string;
}
export declare const GROUP_MEMBER_ADDED_TOPIC = "group.member.added";
export declare const GROUP_MEMBER_REMOVED_TOPIC = "group.member.removed";
export declare const GROUP_DELETED_TOPIC = "group.deleted";
