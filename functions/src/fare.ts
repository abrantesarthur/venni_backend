export function calculateFare(distanceMeters: number): string {
  var result : number;
  if (distanceMeters <= 1500) {
    result = 4;
    return result.toString();
  }
  if (distanceMeters > 1500 && distanceMeters < 10) {
    result = 0.67 * distanceMeters + 3;
    return result.toString();
  }
  result = (0.7 * distanceMeters) / 1000 + 3;
  return result.toString();

}
