import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  // Always initialize a new GoogleGenAI instance with the direct process.env.API_KEY
  private static getAi() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  static async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '9:16') {
    const ai = this.getAi();
    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio
        }
      });

      // Poll for completion with a 10s interval as recommended in the examples
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video generation failed: No URI returned.");

      // Append API key when fetching from the download link
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Error generating video:", error);
      throw error;
    }
  }

  static async suggestCaptions(description: string) {
    const ai = this.getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest 3 catchy captions for a video about: ${description}. Return them as a simple list.`,
    });
    // Access the .text property directly
    return response.text;
  }
}