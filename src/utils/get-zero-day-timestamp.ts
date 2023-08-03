const SECONDS_PER_DAY = 60 * 60 * 24; // 86400

export default function (timestamp: number): number {
    return Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}
