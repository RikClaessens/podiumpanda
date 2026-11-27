import { useLanguage } from "../lib/language";

export function ClickTrackHelp() {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 text-sm">
      <p>{t("Each line is a header, a section row or a comment.")}</p>
      <dl className="space-y-2">
        <div>
          <dt className="font-mono font-semibold">title: Name</dt>
          <dd className="text-muted-foreground">
            {t("Optional name, used for the downloaded files.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">count-in: 2</dt>
          <dd className="text-muted-foreground">
            {t("Bars of count-in before bar 1, from 0 to 8. It sounds slightly lower.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">bars: 28</dt>
          <dd className="text-muted-foreground">
            {t("Total number of bars, not counting the count-in.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">1 4/4 96</dt>
          <dd className="text-muted-foreground">
            {t(
              "Section row: from this bar on, use this time signature and tempo. The first row must be bar 1. The tempo is always in quarter notes per minute.",
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">13 4/4 100-&gt;140</dt>
          <dd className="text-muted-foreground">
            {t(
              "Gradual tempo change: the tempo moves in a straight line up to the next row, or to the end of the track.",
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">fermata: 8 3 2</dt>
          <dd className="text-muted-foreground">
            {t(
              "Fermata: in bar 8, beat 3 is held for 2 extra seconds before the next click. The seconds are optional (2 by default). MIDI files hold at most about 16 seconds.",
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">
            1 6/8 100 group:3+3 sub:3 swing:67 accent:3,1,2
          </dt>
          <dd className="text-muted-foreground">
            {t(
              "Optional row settings: group splits the bar into pulses (3+3 clicks twice in 6/8), sub adds soft subdivisions, swing delays the off-beat of a pair (50-90%), accent sets the strength of each pulse from 0 (silent) to 3.",
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">tempo: 12 3 120-&gt;90</dt>
          <dd className="text-muted-foreground">
            {t("Tempo change inside bar 12, from beat 3 on. Optionally with a gradual change.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">repeat: 24-36 x2</dt>
          <dd className="text-muted-foreground">
            {t("Repeat bars 24 to 36 two more times (once by default). 36-24 also works.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">ending: 35 1,2</dt>
          <dd className="text-muted-foreground">
            {t("Volta ending: bar 35 is only played on passes 1 and 2. Use 35-36 for a range.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">segno: 5 / coda: 30 / tocoda: 20 / fine: 28</dt>
          <dd className="text-muted-foreground">
            {t("Navigation marks. Only one of each is supported.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">ds al coda: 40</dt>
          <dd className="text-muted-foreground">
            {t("D.S. (or dc) from bar 40, optionally al fine or al coda.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">caesura: 8 end 0.5</dt>
          <dd className="text-muted-foreground">
            {t("Short pause (//) after beat 8. Use a beat number or end.")}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold">rit: 17-20 to 70%</dt>
          <dd className="text-muted-foreground">
            {t(
              "rit., rall., accel. and molto variants change the tempo over the bars, to a percentage or a tempo. a tempo: 21 restores the original tempo.",
            )}
          </dd>
        </div>
        <div>
          <dt className="font-mono font-semibold"># comment</dt>
          <dd className="text-muted-foreground">{t("Lines starting with # are ignored.")}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        {t(
          "The click follows the bottom number of the time signature: 6/8 gives six clicks per bar, with an accent on the first. Imported scores keep their repeats, endings and jumps, so the click follows the played order. Fermatas, caesuras, tempo changes, swing and additive meters in imported scores are kept where the file describes them. Exports include the count-in.",
        )}
      </p>
    </div>
  );
}
