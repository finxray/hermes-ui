export type LogTimestampParts = {
  timestamp: string;
  separator: string;
  message: string;
};

const LEADING_LOG_TIMESTAMP = /^(\[?(?:(?:\d{4}-\d{2}-\d{2})[T ])?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?)(\s+)([\s\S]*)$/;

export function splitLogTimestamp(line: string): LogTimestampParts | null {
  const match = line.match(LEADING_LOG_TIMESTAMP);
  if (!match) {
    return null;
  }
  return {
    timestamp: match[1],
    separator: match[2],
    message: match[3]
  };
}
