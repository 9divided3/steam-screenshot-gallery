interface GridSkeletonProps {
  columns: number;
}

export default function GridSkeleton({ columns }: GridSkeletonProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns * 2 }).map((_, i) => (
        <div key={i} className="aspect-[16/10] rounded-xl skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}
