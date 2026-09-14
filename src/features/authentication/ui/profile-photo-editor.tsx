"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import {
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  deleteProfilePhotoAction,
  updateProfilePhotoAction,
} from "@/features/authentication/application/profile-photo-actions"
import {
  allowedProfilePhotoSourceTypes,
  maximumProfilePhotoBytes,
  maximumProfilePhotoSourceBytes,
  maximumProfilePhotoSourcePixels,
  profilePhotoDimension,
} from "@/features/authentication/profile-photo/constants"

type ImageMetrics = Readonly<{ height: number; width: number }>
type Offset = Readonly<{ x: number; y: number }>
type PhotoFeedback = "updated" | "updating" | null

const initialOffset: Offset = { x: 0, y: 0 }
const maximumZoom = 3
const minimumSourceSide = 128

function rotatedDimensions(metrics: ImageMetrics, rotation: number) {
  return Math.abs(rotation % 180) === 90
    ? { height: metrics.width, width: metrics.height }
    : metrics
}

function clampOffset(
  offset: Offset,
  metrics: ImageMetrics,
  rotation: number,
  viewport: number,
  zoom: number,
): Offset {
  const oriented = rotatedDimensions(metrics, rotation)
  const baseScale = Math.max(
    viewport / oriented.width,
    viewport / oriented.height,
  )
  const maxX = Math.max(0, (oriented.width * baseScale * zoom - viewport) / 2)
  const maxY = Math.max(0, (oriented.height * baseScale * zoom - viewport) / 2)
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality))
}

async function makeCroppedPhoto(
  image: HTMLImageElement,
  metrics: ImageMetrics,
  offset: Offset,
  rotation: number,
  viewport: number,
  zoom: number,
) {
  const normalizedRotation = ((rotation % 360) + 360) % 360
  const oriented = rotatedDimensions(metrics, normalizedRotation)
  const rotated = document.createElement("canvas")
  rotated.width = oriented.width
  rotated.height = oriented.height
  const rotatedContext = rotated.getContext("2d")
  if (!rotatedContext) throw new Error("Image editing is unavailable.")

  rotatedContext.translate(oriented.width / 2, oriented.height / 2)
  rotatedContext.rotate((normalizedRotation * Math.PI) / 180)
  rotatedContext.drawImage(
    image,
    -metrics.width / 2,
    -metrics.height / 2,
    metrics.width,
    metrics.height,
  )

  const displayScale =
    Math.max(viewport / oriented.width, viewport / oriented.height) * zoom
  const sourceSize = viewport / displayScale
  const sourceX = (oriented.width - sourceSize) / 2 - offset.x / displayScale
  const sourceY = (oriented.height - sourceSize) / 2 - offset.y / displayScale

  const output = document.createElement("canvas")
  output.width = profilePhotoDimension
  output.height = profilePhotoDimension
  const outputContext = output.getContext("2d")
  if (!outputContext) throw new Error("Image editing is unavailable.")
  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = "high"
  outputContext.drawImage(
    rotated,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    profilePhotoDimension,
    profilePhotoDimension,
  )

  for (const quality of [0.9, 0.82, 0.74, 0.66]) {
    const blob = await canvasBlob(output, quality)
    if (blob && blob.size <= maximumProfilePhotoBytes) return blob
  }
  throw new Error("This photo could not be compressed below 400 KiB.")
}

export function ProfilePhotoEditor({
  currentPhotoUrl,
  name,
  onUpdated,
}: Readonly<{
  currentPhotoUrl: string | null
  name: string
  onUpdated: (photoUrl: string | null) => void
}>) {
  const [open, setOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null)
  const [offset, setOffset] = useState<Offset>(initialOffset)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [viewport, setViewport] = useState(260)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<PhotoFeedback>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const cropRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<Readonly<{
    offset: Offset
    pointerId: number
    x: number
    y: number
  }> | null>(null)

  const releaseSource = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setSourceUrl(null)
    setMetrics(null)
  }, [])

  const close = useCallback(() => {
    if (pending) return
    releaseSource()
    setError(null)
    setOpen(false)
  }, [pending, releaseSource])

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    const crop = cropRef.current
    if (!crop) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport(entry.contentRect.width)
    })
    observer.observe(crop)
    return () => observer.disconnect()
  }, [open, sourceUrl])

  useEffect(() => {
    if (!open) return
    const appViewport = document.getElementById("app-device-viewport")
    appViewport?.classList.add("has-modal-open")
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      appViewport?.classList.remove("has-modal-open")
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [close, open])

  const chooseFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      setError(null)
      if (
        !allowedProfilePhotoSourceTypes.includes(
          file.type as (typeof allowedProfilePhotoSourceTypes)[number],
        )
      ) {
        setError("Choose a JPEG, PNG, or WebP image.")
        return
      }
      if (file.size > maximumProfilePhotoSourceBytes) {
        setError("Choose an image no larger than 8 MiB.")
        return
      }

      releaseSource()
      const nextUrl = URL.createObjectURL(file)
      objectUrlRef.current = nextUrl
      const probe = new window.Image()
      probe.onload = () => {
        if (
          probe.naturalWidth < minimumSourceSide ||
          probe.naturalHeight < minimumSourceSide
        ) {
          URL.revokeObjectURL(nextUrl)
          objectUrlRef.current = null
          setError("Choose an image at least 128×128 pixels.")
          return
        }
        if (
          probe.naturalWidth * probe.naturalHeight >
          maximumProfilePhotoSourcePixels
        ) {
          URL.revokeObjectURL(nextUrl)
          objectUrlRef.current = null
          setError("Choose an image under 40 megapixels.")
          return
        }
        setMetrics({ height: probe.naturalHeight, width: probe.naturalWidth })
        setSourceUrl(nextUrl)
        setOffset(initialOffset)
        setZoom(1)
        setRotation(0)
      }
      probe.onerror = () => {
        URL.revokeObjectURL(nextUrl)
        objectUrlRef.current = null
        setError("That image could not be opened.")
      }
      probe.src = nextUrl
    },
    [releaseSource],
  )

  const rotate = useCallback((degrees: number) => {
    setRotation((current) => (current + degrees + 360) % 360)
    setOffset(initialOffset)
  }, [])

  const save = useCallback(() => {
    if (!imageRef.current || !metrics) return
    setError(null)
    setFeedback("updating")
    startTransition(async () => {
      try {
        const blob = await makeCroppedPhoto(
          imageRef.current!,
          metrics,
          clampOffset(offset, metrics, rotation, viewport, zoom),
          rotation,
          viewport,
          zoom,
        )
        const formData = new FormData()
        formData.set(
          "photo",
          new File([blob], "profile-photo.webp", { type: "image/webp" }),
        )
        const result = await updateProfilePhotoAction(formData)
        if (!result.ok) {
          setFeedback(null)
          setError(result.error.fieldErrors?.photo?.[0] ?? result.error.message)
          return
        }
        onUpdated(result.data.photoUrl)
        setFeedback("updated")
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1400)
        close()
      } catch (caught) {
        setFeedback(null)
        setError(
          caught instanceof Error
            ? caught.message
            : "The photo could not be prepared.",
        )
      }
    })
  }, [close, metrics, offset, onUpdated, rotation, viewport, zoom])

  const remove = useCallback(() => {
    startTransition(async () => {
      const result = await deleteProfilePhotoAction()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      onUpdated(null)
      close()
    })
  }, [close, onUpdated])

  const oriented = metrics ? rotatedDimensions(metrics, rotation) : null
  const baseScale =
    oriented && viewport
      ? Math.max(viewport / oriented.width, viewport / oriented.height)
      : 1
  const effectiveOffset = metrics
    ? clampOffset(offset, metrics, rotation, viewport, zoom)
    : initialOffset

  return (
    <>
      <button
        aria-label={
          currentPhotoUrl ? "Change profile photo" : "Add profile photo"
        }
        className="profile-photo-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Camera aria-hidden="true" />
      </button>
      {feedback ? (
        <span
          aria-live="polite"
          className={`profile-photo-feedback profile-photo-feedback--${feedback}`}
          role="status"
        >
          {feedback === "updating" ? (
            <LoaderCircle aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          <span className="sr-only">
            {feedback === "updating"
              ? "Updating profile photo"
              : "Profile photo updated"}
          </span>
        </span>
      ) : null}
      {open
        ? createPortal(
            <div
              aria-labelledby="profile-photo-dialog-title"
              aria-modal="true"
              className="profile-photo-dialog__overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close()
              }}
              role="dialog"
            >
              <section className="profile-photo-dialog">
                <header className="profile-photo-dialog__header">
                  <div>
                    <small>Profile photo</small>
                    <h3 id="profile-photo-dialog-title">Frame it your way</h3>
                    <p>Move, zoom, and rotate before saving.</p>
                  </div>
                  <Button
                    aria-label="Close profile photo editor"
                    disabled={pending}
                    onClick={close}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </header>

                {sourceUrl && metrics ? (
                  <>
                    <div
                      aria-label="Photo crop area. Drag the image to reposition it."
                      className="profile-photo-crop"
                      onPointerCancel={() => {
                        dragRef.current = null
                      }}
                      onPointerDown={(event) => {
                        dragRef.current = {
                          offset: effectiveOffset,
                          pointerId: event.pointerId,
                          x: event.clientX,
                          y: event.clientY,
                        }
                        event.currentTarget.setPointerCapture(event.pointerId)
                      }}
                      onPointerMove={(event) => {
                        const drag = dragRef.current
                        if (!drag || drag.pointerId !== event.pointerId) return
                        setOffset(
                          clampOffset(
                            {
                              x: drag.offset.x + event.clientX - drag.x,
                              y: drag.offset.y + event.clientY - drag.y,
                            },
                            metrics,
                            rotation,
                            viewport,
                            zoom,
                          ),
                        )
                      }}
                      onPointerUp={(event) => {
                        if (dragRef.current?.pointerId === event.pointerId) {
                          dragRef.current = null
                          event.currentTarget.releasePointerCapture(
                            event.pointerId,
                          )
                        }
                      }}
                      ref={cropRef}
                    >
                      <div
                        className="profile-photo-crop__image-frame"
                        style={{
                          transform: `translate(${effectiveOffset.x}px, ${effectiveOffset.y}px)`,
                        }}
                      >
                        <Image
                          alt=""
                          draggable={false}
                          height={metrics.height}
                          ref={imageRef}
                          src={sourceUrl}
                          style={{
                            height: metrics.height * baseScale,
                            transform: `rotate(${rotation}deg) scale(${zoom})`,
                            width: metrics.width * baseScale,
                          }}
                          unoptimized
                          width={metrics.width}
                        />
                      </div>
                      <span
                        aria-hidden="true"
                        className="profile-photo-crop__mask"
                      />
                      <span className="sr-only">Circular crop preview</span>
                    </div>

                    <div className="profile-photo-controls">
                      <div className="profile-photo-zoom">
                        <ZoomIn aria-hidden="true" />
                        <label htmlFor="profile-photo-zoom">Zoom</label>
                        <input
                          aria-valuetext={`${Math.round(zoom * 100)} percent`}
                          id="profile-photo-zoom"
                          max={maximumZoom}
                          min={1}
                          onChange={(event) =>
                            setZoom(Number(event.target.value))
                          }
                          step={0.01}
                          type="range"
                          value={zoom}
                        />
                        <output>{Math.round(zoom * 100)}%</output>
                      </div>
                      <div className="profile-photo-transform-buttons">
                        <Button
                          aria-label="Rotate left"
                          onClick={() => rotate(-90)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RotateCcw aria-hidden="true" />
                        </Button>
                        <Button
                          aria-label="Center image"
                          onClick={() => {
                            setOffset(initialOffset)
                            setZoom(1)
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Center
                        </Button>
                        <Button
                          aria-label="Rotate right"
                          onClick={() => rotate(90)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RotateCw aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    className="profile-photo-picker"
                    onClick={() => inputRef.current?.click()}
                    type="button"
                  >
                    {currentPhotoUrl ? (
                      <Image
                        alt={`${name}'s current profile photo`}
                        className="profile-photo-picker__current"
                        height={96}
                        src={currentPhotoUrl}
                        unoptimized
                        width={96}
                      />
                    ) : (
                      <span className="profile-photo-picker__icon">
                        <ImagePlus aria-hidden="true" />
                      </span>
                    )}
                    <strong>Choose a photo</strong>
                    <span>JPEG, PNG, or WebP · up to 8 MiB</span>
                  </button>
                )}

                <input
                  accept={allowedProfilePhotoSourceTypes.join(",")}
                  className="sr-only"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0])
                    event.currentTarget.value = ""
                  }}
                  ref={inputRef}
                  type="file"
                />

                {error ? (
                  <p className="profile-photo-dialog__error" role="alert">
                    {error}
                  </p>
                ) : null}

                <footer
                  className={`profile-photo-dialog__footer${
                    sourceUrl
                      ? " profile-photo-dialog__footer--editing"
                      : currentPhotoUrl
                        ? " profile-photo-dialog__footer--with-photo"
                        : ""
                  }`}
                >
                  <div>
                    {currentPhotoUrl && !sourceUrl ? (
                      <Button
                        className="profile-photo-remove"
                        disabled={pending}
                        onClick={remove}
                        type="button"
                        variant="outline"
                      >
                        {pending ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 aria-hidden="true" />
                        )}
                        {pending ? "Removing" : "Remove photo"}
                      </Button>
                    ) : null}
                  </div>
                  <div className="profile-photo-dialog__actions">
                    {sourceUrl ? (
                      <Button
                        className="profile-photo-dialog__secondary"
                        disabled={pending}
                        onClick={() => inputRef.current?.click()}
                        type="button"
                        variant="outline"
                      >
                        Choose another
                      </Button>
                    ) : null}
                    <Button
                      className="profile-photo-dialog__primary"
                      disabled={!sourceUrl || pending}
                      onClick={save}
                      type="button"
                    >
                      {pending ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="animate-spin"
                        />
                      ) : (
                        <Camera aria-hidden="true" />
                      )}
                      {pending ? "Saving" : "Save photo"}
                    </Button>
                  </div>
                </footer>
              </section>
            </div>,
            document.getElementById("app-device-viewport") ?? document.body,
          )
        : null}
    </>
  )
}
