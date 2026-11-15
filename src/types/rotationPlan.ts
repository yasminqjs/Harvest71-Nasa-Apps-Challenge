export interface SavedRotationPlan {
  savedAt: string;
  cycles: {
    crop: string;
    planting_date: string;
    end_date: string;
  }[];
}
