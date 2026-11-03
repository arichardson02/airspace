import { useEffect, useRef, type RefObject } from "react";

/** A ref that holds the latest `value`, for callbacks that outlive a render (event handlers set up once). */
export function useLatest<T>(value: T): RefObject<T> {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  return latest;
}
