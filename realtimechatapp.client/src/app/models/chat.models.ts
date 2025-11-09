export interface OnlineUser {
  id: string;
  userName: string;
  fullName: string;
  profilePicture: string;
  isOnline: boolean;
  unreadCount: number;
}

export interface MessageRequest {
  receiverId: string;
  content: string;
}

export interface MessageResponse {
  id: number;
  content: string;
  createdDate: string;
  receiverId: string;
  senderId: string;
  sentiment?: string;
}
