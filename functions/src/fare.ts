export function calculateFare(distanceMeters: number): string {
  var result : number;
  if (distanceMeters <= 1500) {
    result = 4;
    return result.toString();
  }
  if (distanceMeters > 1500 && distanceMeters < 10000) {
    result = 0.67 * distanceMeters / 1000 + 3;
    console.log(result);
    return Math.round((result * 100) / 100).toString();
  }
  result = 0.7 * distanceMeters / 1000 + 3;
  console.log(result);
  return  Math.round((result * 100) / 100).toString();

}
