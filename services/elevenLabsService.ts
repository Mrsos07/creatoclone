
export class ElevenLabsService {
  static async generateSpeech(text: string, voiceId: string, apiKey: string) {
    if (!apiKey) throw new Error("ElevenLabs API Key is required.");
    
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // تم التحديث لدعم العربية واللغات الأخرى بجودة عالية
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("ElevenLabs API Error:", errData);
        throw new Error(errData.detail?.message || `خطأ في ElevenLabs: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error("الملف الصوتي الناتج فارغ.");
      
      return URL.createObjectURL(blob);
    } catch (error: any) {
      console.error("ElevenLabs Service Error:", error);
      throw error;
    }
  }
}
