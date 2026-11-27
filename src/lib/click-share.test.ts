import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, sharedValue, shareUrl } from "./click-share";
import { EXAMPLE_TRACK_TEXT } from "./click-track";

describe("share links", () => {
  it("round-trips the example track through the hash", async () => {
    const url = await shareUrl(EXAMPLE_TRACK_TEXT, {
      origin: "https://x.test",
      pathname: "/apps/click-track",
    });
    const value = sharedValue(new URL(url).hash);
    expect(value).not.toBeNull();
    expect(await decodeShare(value!)).toBe(EXAMPLE_TRACK_TEXT);
  });

  it("handles unicode and rejects garbage", async () => {
    expect(await decodeShare(await encodeShare("title: Ça va ♩"))).toBe("title: Ça va ♩");
    expect(await decodeShare("zAAAA!!")).toBeNull();
    expect(sharedValue("#other=1")).toBeNull();
  });
});
