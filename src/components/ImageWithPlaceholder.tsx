import { memo, useEffect, useState } from 'react'
import { Camera } from 'lucide-react'

type Props = {
  src: string
  alt: string
}

export const ImageWithPlaceholder = memo(function ImageWithPlaceholder({ src, alt }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
  }, [src])

  return (
    <div className="w-full h-full relative bg-slate-50 transform-gpu" style={{ contentVisibility: 'auto', contain: 'paint' }}>
      {!ready ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-12 pointer-events-none">
          <Camera className="w-20 h-20 mb-6 opacity-20" />
          <p className="text-sm font-bold">Memuat Foto...</p>
        </div>
      ) : null}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
        className={`w-full h-full ${ready ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        style={{ objectFit: 'contain' }}
      />
    </div>
  )
}, (prev, next) => prev.src === next.src && prev.alt === next.alt)

