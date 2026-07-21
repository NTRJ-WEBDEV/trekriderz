"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export default function ImageGallery({ images }: { images: string[] }) {
  const valid = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const [brokenMain, setBrokenMain] = useState(false);

  if (valid.length === 0) {
    return (
      <div
        className="w-full aspect-video rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}
      >
        <div className="flex flex-col items-center gap-2 text-white/25">
          <ImageOff size={28} />
          <span className="text-xs">No images provided</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className="w-full aspect-video rounded-2xl overflow-hidden mb-2 flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {brokenMain ? (
          <ImageOff size={28} className="text-white/20" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valid[active]}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setBrokenMain(true)}
          />
        )}
      </div>
      {valid.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {valid.map((src, i) => (
            <button
              key={src + i}
              onClick={() => { setActive(i); setBrokenMain(false); }}
              className="w-16 h-16 rounded-lg overflow-hidden shrink-0"
              style={{ border: i === active ? "2px solid #F97316" : "1px solid rgba(255,255,255,0.1)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
