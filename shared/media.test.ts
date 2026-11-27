import { describe, expect, it } from "vitest";
import { mediaEmbed, mediaProvider, pieceLinkSchema } from "./media";

describe("piece media links", () => {
  it("supports common YouTube links without forwarding unrelated query parameters", () => {
    for (const url of [
      "https://youtu.be/M7lc1UVf-VE?si=tracking",
      "https://www.youtube.com/watch?v=M7lc1UVf-VE&secret=private",
      "https://youtube.com/shorts/M7lc1UVf-VE",
      "https://www.youtube.com/live/M7lc1UVf-VE",
    ])
      expect(mediaEmbed(url)).toEqual({
        provider: "YouTube",
        src: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
        videoId: "M7lc1UVf-VE",
      });
  });
  it("supports Spotify tracks and localized album links", () => {
    expect(mediaEmbed("https://open.spotify.com/track/1234567890123456789012?si=tracking")).toEqual(
      {
        provider: "Spotify",
        src: "https://open.spotify.com/embed/track/1234567890123456789012",
        isCollection: false,
      },
    );
    expect(mediaEmbed("https://open.spotify.com/intl-nl/album/1234567890123456789012")).toEqual({
      provider: "Spotify",
      src: "https://open.spotify.com/embed/album/1234567890123456789012",
      isCollection: true,
    });
  });
  it("does not embed arbitrary hosts, spoofed providers, or invalid IDs", () => {
    expect(mediaEmbed("https://example.com/music")).toBeNull();
    expect(mediaEmbed("https://youtube.com.evil.example/watch?v=M7lc1UVf-VE")).toBeNull();
    expect(mediaEmbed("https://youtube.com/watch?v=invalid")).toBeNull();
    expect(() => mediaEmbed("javascript:alert(1)")).toThrow();
    expect(pieceLinkSchema.safeParse("https://user:password@example.com/music").success).toBe(
      false,
    );
    expect(pieceLinkSchema.parse(undefined)).toBe("");
  });
  it("identifies provider links even when they cannot be embedded, without trusting spoofed hosts", () => {
    expect(mediaProvider("https://www.youtube.com/playlist?list=example")).toBe("YouTube");
    expect(mediaProvider("https://open.spotify.com/artist/example")).toBe("Spotify");
    expect(mediaProvider("https://open.spotify.com.evil.example/track/1")).toBeNull();
    expect(mediaProvider("https://youtube.com.evil.example/watch?v=example")).toBeNull();
    expect(mediaProvider("")).toBeNull();
  });
});
