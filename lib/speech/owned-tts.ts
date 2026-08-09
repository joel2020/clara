/** One audio owner: generation + abort + exactly one owned object URL. */
export class OwnedTtsSession {
  private generation = 0;
  private controller: AbortController | null = null;
  private url: string | null = null;

  constructor(private readonly audio: HTMLAudioElement) {}

  dispose(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    this.audio.pause();
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  async speak(load: (signal: AbortSignal) => Promise<Blob>): Promise<"played" | "disposed" | "failed"> {
    this.dispose();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const blob = await load(controller.signal);
      if (controller.signal.aborted || generation !== this.generation) return "disposed";
      const url = URL.createObjectURL(blob);
      if (controller.signal.aborted || generation !== this.generation) {
        URL.revokeObjectURL(url);
        return "disposed";
      }
      this.url = url;
      this.audio.src = url;
      const release = () => {
        if (generation !== this.generation || this.url !== url) return;
        URL.revokeObjectURL(url);
        this.url = null;
        this.audio.removeAttribute("src");
        this.audio.onended = null;
        this.audio.onerror = null;
      };
      this.audio.onended = release;
      this.audio.onerror = release;
      try {
        await this.audio.play();
      } catch {
        release();
        return "failed";
      }
      return generation === this.generation ? "played" : "disposed";
    } catch {
      return controller.signal.aborted || generation !== this.generation ? "disposed" : "failed";
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
