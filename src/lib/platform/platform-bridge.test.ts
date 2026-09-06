import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cancelTimerNotification,
  clearAppBadge,
  closeAuthSession,
  getPlatform,
  isCapacitorNative,
  isNativeApp,
  openAuthSession,
  scheduleTimerNotification,
  setAppBadge,
  setupAuthDeepLinkListener,
  triggerHaptic,
} from "./platform-bridge"

describe("platform-bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("getPlatform", () => {
    it("identifies android from userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      })
      expect(getPlatform()).toBe("android")
    })

    it("identifies ios from userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      })
      expect(getPlatform()).toBe("ios")
    })

    it("defaults to web for desktop or unrecognized userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      })
      expect(getPlatform()).toBe("web")
    })
  })

  describe("isNativeApp", () => {
    it("returns true when display-mode is standalone (Android WebAPK)", () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))
      expect(isNativeApp()).toBe(true)
    })

    it("returns true when Capacitor native platform is detected", () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }))
      vi.stubGlobal("Capacitor", {
        isNativePlatform: () => true,
      })
      expect(isNativeApp()).toBe(true)
    })

    it("returns false in standard browser mode", () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }))
      expect(isNativeApp()).toBe(false)
    })
  })

  describe("triggerHaptic", () => {
    it("calls navigator.vibrate with the selection pattern", () => {
      const vibrateMock = vi.fn()
      vi.stubGlobal("navigator", {
        vibrate: vibrateMock,
      })

      triggerHaptic("selection")
      expect(vibrateMock).toHaveBeenCalledWith(10)
    })

    it("calls navigator.vibrate with the success pattern", () => {
      const vibrateMock = vi.fn()
      vi.stubGlobal("navigator", {
        vibrate: vibrateMock,
      })

      triggerHaptic("success")
      expect(vibrateMock).toHaveBeenCalledWith([20, 40, 30])
    })

    it("forwards to Capacitor Haptics plugin when available", () => {
      const impactMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("Capacitor", {
        Plugins: {
          Haptics: {
            impact: impactMock,
          },
        },
      })

      triggerHaptic("selection")
      expect(impactMock).toHaveBeenCalledWith({ style: "LIGHT" })
    })

    it("does not throw when vibrate fails or is restricted", () => {
      vi.stubGlobal("navigator", {
        vibrate: () => {
          throw new Error("Vibration blocked")
        },
      })

      expect(() => triggerHaptic("warning")).not.toThrow()
    })
  })

  describe("badging", () => {
    it("calls navigator.setAppBadge when count > 0", async () => {
      const setBadgeMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("navigator", {
        setAppBadge: setBadgeMock,
      })

      await setAppBadge(3)
      expect(setBadgeMock).toHaveBeenCalledWith(3)
    })

    it("calls navigator.clearAppBadge when count is 0", async () => {
      const clearBadgeMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("navigator", {
        clearAppBadge: clearBadgeMock,
      })

      await setAppBadge(0)
      expect(clearBadgeMock).toHaveBeenCalled()
    })

    it("clearAppBadge function calls navigator.clearAppBadge", async () => {
      const clearBadgeMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("navigator", {
        clearAppBadge: clearBadgeMock,
      })

      await clearAppBadge()
      expect(clearBadgeMock).toHaveBeenCalled()
    })
  })

  describe("timer notifications", () => {
    it("posts message to ServiceWorker controller when scheduling", async () => {
      const postMessageMock = vi.fn()
      vi.stubGlobal("navigator", {
        serviceWorker: {
          controller: {
            postMessage: postMessageMock,
          },
        },
      })

      await scheduleTimerNotification({
        targetTimestamp: Date.now() + 15000,
        title: "25m Pomodoro Complete!",
        body: "Time for a break",
        tag: "timer-completion",
      })

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SCHEDULE_TIMER_NOTIFICATION",
          title: "25m Pomodoro Complete!",
        }),
      )
    })

    it("posts cancel message to ServiceWorker controller when cancelling", async () => {
      const postMessageMock = vi.fn()
      vi.stubGlobal("navigator", {
        serviceWorker: {
          controller: {
            postMessage: postMessageMock,
          },
        },
      })

      await cancelTimerNotification("timer-completion")
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CANCEL_TIMER_NOTIFICATION",
          tag: "timer-completion",
        }),
      )
    })

    it("forwards to Capacitor LocalNotifications plugin when available", async () => {
      const scheduleMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("Capacitor", {
        Plugins: {
          LocalNotifications: {
            schedule: scheduleMock,
          },
        },
      })

      await scheduleTimerNotification({
        targetTimestamp: Date.now() + 10000,
        title: "Test",
      })

      expect(scheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({ id: 1001, title: "Test" }),
          ]),
        }),
      )
    })
  })

  describe("isCapacitorNative", () => {
    it("returns true only when Capacitor native platform is detected", () => {
      vi.stubGlobal("Capacitor", {
        isNativePlatform: () => true,
      })
      expect(isCapacitorNative()).toBe(true)
    })

    it("returns false on standard web browser", () => {
      expect(isCapacitorNative()).toBe(false)
    })
  })

  describe("auth sessions & deep linking", () => {
    it("opens URL via Capacitor Browser plugin on Android native container", async () => {
      const openMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("Capacitor", {
        Plugins: {
          Browser: {
            open: openMock,
          },
        },
      })

      await openAuthSession("https://accounts.google.com/o/oauth2/v2/auth")
      expect(openMock).toHaveBeenCalledWith({
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        windowName: "_system",
      })
    })

    it("closes browser session via Capacitor Browser plugin", async () => {
      const closeMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("Capacitor", {
        Plugins: {
          Browser: {
            close: closeMock,
          },
        },
      })

      await closeAuthSession()
      expect(closeMock).toHaveBeenCalled()
    })

    it("subscribes and receives deep link return via Capacitor App plugin", () => {
      let listenerCallback: ((data: { url: string }) => void) | null = null
      const removeMock = vi.fn()

      vi.stubGlobal("Capacitor", {
        Plugins: {
          App: {
            addListener: (
              _event: string,
              cb: (data: { url: string }) => void,
            ) => {
              listenerCallback = cb
              return { remove: removeMock }
            },
          },
        },
      })

      const onDeepLink = vi.fn()
      const cleanup = setupAuthDeepLinkListener(onDeepLink)

      expect(listenerCallback).not.toBeNull()
      const trigger = listenerCallback as
        ((data: { url: string }) => void) | null
      trigger?.({ url: "daymark://auth/callback?next=/quests" })

      expect(onDeepLink).toHaveBeenCalledWith(
        "daymark://auth/callback?next=/quests",
      )

      cleanup()
      expect(removeMock).toHaveBeenCalled()
    })
  })
})
