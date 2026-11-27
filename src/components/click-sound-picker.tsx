import { useState } from "react";
import { useLanguage } from "../lib/language";
import {
  CLICK_SOUND_STORAGE_KEY,
  DEFAULT_CLICK_SOUND,
  clickSounds,
  isClickSound,
  previewClick,
  type ClickSound,
} from "../lib/click-audio";
import { Picker } from "./picker";

function savedSound(): ClickSound {
  try {
    const saved = window.localStorage.getItem(CLICK_SOUND_STORAGE_KEY);
    if (isClickSound(saved)) return saved;
  } catch (error) {
    console.warn("Could not read the click sound preference.", error);
  }
  return DEFAULT_CLICK_SOUND;
}

export function useClickSound() {
  const [sound, setSound] = useState<ClickSound>(savedSound);
  const [saveFailed, setSaveFailed] = useState(false);
  function change(next: ClickSound) {
    setSound(next);
    try {
      window.localStorage.setItem(CLICK_SOUND_STORAGE_KEY, next);
      setSaveFailed(false);
    } catch (error) {
      console.warn("Could not save the click sound preference.", error);
      setSaveFailed(true);
    }
  }
  return { sound, change, saveFailed };
}

export function ClickSoundPicker({
  sound,
  onChange,
  saveFailed,
  className,
}: {
  sound: ClickSound;
  onChange: (sound: ClickSound) => void;
  saveFailed?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor="click-sound">{t("Click sound")}</label>
      <Picker
        id="click-sound"
        value={sound}
        className="w-full"
        onValueChange={(value) => {
          if (!isClickSound(value)) return;
          onChange(value);
          previewClick(value);
        }}
        options={clickSounds.map((item) => ({ value: item.id, label: t(item.label) }))}
      />
      {saveFailed && (
        <p role="alert" className="text-xs text-destructive">
          {t("Your sound choice could not be saved on this device.")}
        </p>
      )}
    </div>
  );
}
