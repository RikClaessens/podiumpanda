import { useId } from "react";
import {
  AudioLines,
  AudioWaveform,
  BoomBox,
  CassetteTape,
  CircleDot,
  Disc3,
  Drum,
  Guitar,
  Headphones,
  KeyboardMusic,
  ListMusic,
  Mic,
  MicVocal,
  Music,
  Music2,
  Music3,
  Music4,
  Piano,
  Radio,
  Speaker,
  Triangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { groupIconSchema, type GroupIcon as GroupIconName } from "../../shared/model";
import { useLanguage } from "../lib/language";

const icons = {
  users: { icon: Users, label: "People" },
  drum: { icon: Drum, label: "Drum" },
  triangle: { icon: Triangle, label: "Triangle" },
  cymbal: { icon: CircleDot, label: "Cymbal" },
  guitar: { icon: Guitar, label: "Guitar" },
  piano: { icon: Piano, label: "Piano" },
  keyboard: { icon: KeyboardMusic, label: "Keyboard" },
  microphone: { icon: Mic, label: "Microphone" },
  vocal: { icon: MicVocal, label: "Singing" },
  music: { icon: Music, label: "Music note" },
  music2: { icon: Music2, label: "Music note 2" },
  music3: { icon: Music3, label: "Music notes" },
  music4: { icon: Music4, label: "Music notes 2" },
  listMusic: { icon: ListMusic, label: "Music list" },
  audioLines: { icon: AudioLines, label: "Sound bars" },
  audioWaveform: { icon: AudioWaveform, label: "Sound wave" },
  headphones: { icon: Headphones, label: "Headphones" },
  speaker: { icon: Speaker, label: "Speaker" },
  radio: { icon: Radio, label: "Radio" },
  boombox: { icon: BoomBox, label: "Boombox" },
  disc: { icon: Disc3, label: "Record" },
  cassette: { icon: CassetteTape, label: "Cassette" },
} satisfies Record<GroupIconName, { icon: LucideIcon; label: string }>;

export function GroupIcon({
  icon,
  size = 22,
  className,
}: {
  icon: GroupIconName;
  size?: number;
  className?: string;
}) {
  const Icon = icons[icon].icon;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function GroupIconPicker({
  value,
  onChange,
}: {
  value: GroupIconName;
  onChange: (icon: GroupIconName) => void;
}) {
  const { t } = useLanguage();
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t("Group icon")}</legend>
      <div className="grid max-w-xs grid-cols-6 gap-1.5">
        {groupIconSchema.options.map((icon) => (
          <label key={icon} title={t(icons[icon].label)} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={icon}
              checked={value === icon}
              onChange={() => onChange(icon)}
              className="peer sr-only"
            />
            <span className="flex aspect-square items-center justify-center rounded-md border text-muted-foreground hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
              <GroupIcon icon={icon} size={20} />
            </span>
            <span className="sr-only">{t(icons[icon].label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
