// Default scoring config for a new reward_campaigns row — used only when
// seeding/creating a campaign. The authoritative values for an existing
// campaign live in its own `scoring_weights`/`min_active_days` columns,
// read directly by compute_reward_campaign_scores() in the DB. This file
// is not consulted at scoring time, only when a new campaign is created,
// so weights never end up duplicated across UI components.
export interface RewardScoringWeights {
  activeDay: number;
  post: number;
  reel: number;
  story: number;
  comment: number;
  likeGiven: number;
}

export const DEFAULT_WEIGHTS: RewardScoringWeights = {
  activeDay: 10,
  post: 5,
  reel: 8,
  story: 3,
  comment: 2,
  likeGiven: 1,
};

export const DEFAULT_MIN_ACTIVE_DAYS = 3;
