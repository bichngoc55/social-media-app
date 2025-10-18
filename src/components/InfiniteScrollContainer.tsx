import { useInView } from "react-intersection-observer";
import { useCallback, useRef } from "react";

interface InfiniteScrollContainerProps extends React.PropsWithChildren {
  onBottomReached: () => void;
  className?: string;
}

export default function InfiniteScrollContainer({
  children,
  onBottomReached,
  className,
}: InfiniteScrollContainerProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedOnBottomReached = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onBottomReached();
    }, 100); // 100ms debounce
  }, [onBottomReached]);

  const { ref } = useInView({
    rootMargin: "200px",
    onChange(inView) {
      if (inView) {
        debouncedOnBottomReached();
      }
    },
  });

  return (
    <div className={className}>
      {children}
      <div ref={ref} />
    </div>
  );
}
