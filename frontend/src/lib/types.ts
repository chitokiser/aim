export interface User {
  id: string;
  telegramId?: string;
  googleId?: string;
  email?: string;
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string | null;
  points: number;
  freePoints?: number;
  level?: number;
  exp?: number;
  totalExp?: number;
  mentorId?: string;
  mentorUsername?: string;
  referralCode: string;
  createdAt: Date;
  isAdmin?: boolean;
  isAdvertiser?: boolean;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  reward: number;
  totalBudget: number;
  remainingBudget: number;
  participationCondition: string;
  requiredTags: string[];
  advertiserId: string;
  advertiserName: string;
  status: "active" | "ended" | "pending";
  participantCount: number;
  missionType: "sns_post" | "blog_post" | "review" | "signup" | "cf_video" | "cm_song";
  targetUrl?: string;
  logoUrl?: string;
  clickReward?: number;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  missionId?: string;
  platform: "instagram" | "youtube" | "tiktok" | "blog" | "twitter" | "other";
  postUrl: string;
  content: string;
  tags: string[];
  status: "pending" | "approved" | "rejected";
  points: number;
  likes: number;
  comments: number;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface PointTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "post_reward" | "like_reward" | "comment_reward" | "mission_reward" | "referral_bonus" | "withdrawal";
  description: string;
  missionId?: string;
  postId?: string;
  createdAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  photoUrl?: string;
  points: number;
  postCount: number;
}

export interface Advertiser {
  id: string;
  userId: string;
  companyName: string;
  contactEmail: string;
  balance: number;
  totalSpent: number;
  missionCount: number;
  createdAt: Date;
}
