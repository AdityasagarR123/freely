/** Full-screen region selector: shows a frozen screenshot and lets the user drag a rectangle. */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'

type Point = { x: number; y: number }

function RegionSelector(): React.JSX.Element {
  const [image, setImage] = useState('')
  const [start, setStart] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)

  useEffect(() => {
    void window.freelyRegion.getImage().then(setImage)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.freelyRegion.done(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rect =
    start && end
      ? {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        }
      : null

  return (
    <div
      className="relative h-full w-full"
      style={{ backgroundImage: image ? `url(${image})` : undefined, backgroundSize: '100% 100%' }}
      onMouseDown={(e) => {
        setStart({ x: e.clientX, y: e.clientY })
        setEnd({ x: e.clientX, y: e.clientY })
      }}
      onMouseMove={(e) => start && setEnd({ x: e.clientX, y: e.clientY })}
      onMouseUp={() => window.freelyRegion.done(rect && rect.width > 3 && rect.height > 3 ? rect : null)}
    >
      {/* Dim everything except the selection using a huge box-shadow around it. */}
      {rect ? (
        <div
          className="absolute border-2 border-[#7aa2ff]"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/45" />
      )}
      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-lg bg-black/70 px-3 py-1.5 text-sm text-white">
        Drag to select an area · Esc to cancel
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RegionSelector />)
