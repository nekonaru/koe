export interface TranscriptTemplate {
  id: string
  name: string
  description: string
  language: string
  model: 'tiny' | 'base' | 'small'
  task: 'transcribe' | 'translate'
  format: 'txt' | 'srt' | 'vtt' | 'json' | 'csv'
  displayMode: 'lines' | 'karaoke'
}

export const TEMPLATES: readonly TranscriptTemplate[] = [
  { id: 'interview', name: 'Interview', description: 'Indonesian speech, word highlighting, plain text', language: 'indonesian', model: 'tiny', task: 'transcribe', format: 'txt', displayMode: 'karaoke' },
  { id: 'lecture', name: 'Lecture', description: 'Long English talk, balanced model, subtitles', language: 'english', model: 'base', task: 'transcribe', format: 'srt', displayMode: 'lines' },
  { id: 'podcast', name: 'Podcast', description: 'Mixed languages, English transcript, Markdown', language: 'auto', model: 'tiny', task: 'translate', format: 'txt', displayMode: 'karaoke' },
  { id: 'meeting', name: 'Meeting', description: 'Indonesian discussion, spreadsheet export', language: 'indonesian', model: 'tiny', task: 'transcribe', format: 'csv', displayMode: 'lines' },
] as const
