import type { Review } from "@prisma/client";
import { StarRating } from "@/components/star-rating";

interface ReviewListProps {
  reviews: Review[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No reviews yet. Be the first to review this tool.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{review.title}</p>
              <p className="text-xs text-muted-foreground">
                {review.authorName}
                {review.authorRole && ` · ${review.authorRole}`}
                {review.authorCompany && ` at ${review.authorCompany}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <StarRating rating={review.rating} size="sm" />
              {review.verified && (
                <p className="mt-0.5 text-xs text-green-600">✓ Verified</p>
              )}
            </div>
          </div>

          {/* Sub-scores */}
          {(review.easeOfUse || review.valueForMoney || review.features || review.support) && (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
              {review.easeOfUse && (
                <span className="text-xs text-muted-foreground">
                  Ease of use: <strong>{review.easeOfUse}/5</strong>
                </span>
              )}
              {review.valueForMoney && (
                <span className="text-xs text-muted-foreground">
                  Value: <strong>{review.valueForMoney}/5</strong>
                </span>
              )}
              {review.features && (
                <span className="text-xs text-muted-foreground">
                  Features: <strong>{review.features}/5</strong>
                </span>
              )}
              {review.support && (
                <span className="text-xs text-muted-foreground">
                  Support: <strong>{review.support}/5</strong>
                </span>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground line-clamp-4">{review.body}</p>

          {(review.pros.length > 0 || review.cons.length > 0) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {review.pros.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700">Pros</p>
                  <ul className="mt-1 space-y-0.5">
                    {review.pros.map((p, i) => (
                      <li key={i} className="text-xs text-muted-foreground">+ {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.cons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-700">Cons</p>
                  <ul className="mt-1 space-y-0.5">
                    {review.cons.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground">− {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
