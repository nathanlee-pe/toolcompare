import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number; // 0-5, supports decimals
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  size = "md",
  showNumber = false,
  className,
}: StarRatingProps) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = Math.min(Math.max(rating - i, 0), 1); // 0, 0-1, or 1
    return filled;
  });

  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-1", sizeClass, className)}>
      {stars.map((fill, i) => (
        <span key={i} className="relative inline-block">
          {/* Empty star */}
          <span className="text-muted-foreground/30">★</span>
          {/* Filled overlay */}
          {fill > 0 && (
            <span
              className="absolute inset-0 overflow-hidden text-yellow-400"
              style={{ width: `${fill * 100}%` }}
            >
              ★
            </span>
          )}
        </span>
      ))}
      {showNumber && (
        <span className="ml-1 text-sm text-muted-foreground">{rating.toFixed(1)}</span>
      )}
    </span>
  );
}
