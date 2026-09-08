export type TrackLyricsInfo = {
  uri: string;
  id: string;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
};

export type TimedLine = {
  text: string;
  startTimeMs: number;
  endTimeMs?: number;
};

export type TimedWord = {
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  isPartOfWord: boolean;
};

export type TimedWordLine = {
  startTimeMs: number;
  endTimeMs: number;
  words: TimedWord[];
};

export type ExternalLyricsResult = {
  lyrics: any;
  status: number;
};

export type SpicyLyricsCreditSource = {
  SongWriters?: string[];
};
