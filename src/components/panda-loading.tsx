import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";

export function PandaLoading({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="loading-region py-8" aria-busy="true">
      {visible && (
        <output className="panda-loading grid justify-items-center gap-3 text-center">
          <div className="panda-stage" aria-hidden="true">
            <Music2 size={20} className="loading-note loading-note-left" />
            <img
              src="/podiumpanda-full.png"
              alt=""
              width={112}
              height={125}
              className="panda-conductor"
            />
            <Music2 size={18} className="loading-note loading-note-right" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </output>
      )}
    </div>
  );
}
