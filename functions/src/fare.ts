import { toTwoFixedNumber } from "./utils";

// calculateFare uses trip distance to calculate fare price in cents
export function calculateFare(distanceMeters: number): number {
  var result: number;
  if (distanceMeters <= 1500) {
    result = 4;
    return result * 100;
  }
  if (distanceMeters > 1500 && distanceMeters < 10000) {
    result = (0.67 * distanceMeters) / 1000 + 3;
    return toTwoFixedNumber(result) * 100;
  }
  result = (0.7 * distanceMeters) / 1000 + 3;
  return toTwoFixedNumber(result) * 100;
}
