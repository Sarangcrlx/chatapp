export interface User {
  id: string;
  username: string;
  joinedAt: number;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  type: "user" | "system";
}
