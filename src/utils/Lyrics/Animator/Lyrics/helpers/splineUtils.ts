import Spline from "npm:cubic-spline";

// Define types for animation ranges
export interface AnimationPoint {
  Time: number;
  Value: number;
}

// Methods
export const GetSpline = (range: AnimationPoint[]) => {
  const times = range.map((value) => value.Time);
  const values = range.map((value) => value.Value);

  return new Spline(times, values);
};

export const Clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(value, max));
};
