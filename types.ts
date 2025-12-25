
export type LayerType = 'text' | 'image' | 'video' | 'shape' | 'audio';

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  content: string; // Text content or URL (Blob/External)
  start: number; // in seconds
  duration: number; // in seconds
  fill?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  zIndex: number;
  volume?: number;
  script?: string; // النص البرمجي الخاص بالفويس أوفر أو النصوص الذكية
  voiceId?: string; // معرف الصوت المستخدم من ElevenLabs
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number; // total duration in seconds
  layers: Layer[];
  elevenLabsApiKey?: string; // مفتاح API المحفوظ في القالب
}

export interface EditorState {
  currentTime: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  zoom: number;
}
