export const APPLICATION_STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PIPELINE_STATUSES: ApplicationStatus[] = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
];

export const statusColors: Record<string, string> = {
  wishlist: "bg-muted text-muted-foreground",
  applied: "bg-primary/10 text-primary",
  screening: "bg-warning/10 text-warning-foreground",
  interviewing: "bg-chart-2/10 text-foreground",
  offer: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

export const statusLabel: Record<string, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
