'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Bell, RefreshCw, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  const subscribeToPush = useCallback(async (registration: ServiceWorkerRegistration) => {
    try {
      if (!VAPID_PUBLIC_KEY) return

      const existingSub = await registration.pushManager.getSubscription()
      if (existingSub) {
        // Already subscribed, sync with server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: existingSub.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(existingSub.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(existingSub.getKey('auth')!))),
            },
          }),
        })
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })

      // Send subscription to server
      const p256dh = subscription.getKey('p256dh')
      const auth = subscription.getKey('auth')
      if (p256dh && auth) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
              auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
            },
          }),
        })
      }
    } catch (error) {
      console.error('[PWA] Push subscription failed:', error)
    }
  }, [])

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // If notifications already granted, subscribe silently
        if (Notification.permission === 'granted') {
          subscribeToPush(reg)
        } else if (Notification.permission === 'default') {
          // Show notification prompt after a delay (not immediately)
          const notifDismissed = localStorage.getItem('push-dismissed')
          if (!notifDismissed) {
            setTimeout(() => setShowNotificationPrompt(true), 5000)
          }
        }

        // Detect SW updates
        reg.onupdatefound = () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.onstatechange = () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed, waiting to activate
              setWaitingWorker(newWorker)
              setShowUpdateBanner(true)
            }
          }
        }
      }).catch(() => {
        // SW registration failed silently
      })

      // Listen for controller change (after skipWaiting)
      const controllerChangeHandler = () => {
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler)

      // Cleanup will be handled by component unmount — however serviceWorker listeners
      // persist beyond component lifecycle intentionally (reload on SW update is global behavior)
    }

    // Install banner
    const dismissed = localStorage.getItem('pwa-dismissed')
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    const appInstalledHandler = () => {
      setShowBanner(false)
      setInstallPrompt(null)
    }
    window.addEventListener('appinstalled', appInstalledHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', appInstalledHandler)
    }
  }, [subscribeToPush])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setInstallPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-dismissed', '1')
  }

  const handleEnableNotifications = async () => {
    setShowNotificationPrompt(false)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const reg = await navigator.serviceWorker.ready
        await subscribeToPush(reg)
      }
    } catch (error) {
      console.error('[PWA] Notification permission error:', error)
    }
  }

  const handleDismissNotifications = () => {
    setShowNotificationPrompt(false)
    localStorage.setItem('push-dismissed', '1')
  }

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    setShowUpdateBanner(false)
  }

  const handleDismissUpdate = () => {
    setShowUpdateBanner(false)
  }

  return (
    <>
      {/* SW Update Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#20364e] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <RefreshCw className="h-5 w-5 shrink-0" />
            <p className="text-sm truncate">
              Nova versao disponivel
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUpdate}
              className="bg-white text-[#20364e] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Atualizar
            </button>
            <button
              onClick={handleDismissUpdate}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Install PWA Banner */}
      {showBanner && !showUpdateBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#20364e] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <Download className="h-5 w-5 shrink-0" />
            <p className="text-sm truncate">
              Instale o app para acesso rapido aos materiais
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              className="bg-white text-[#20364e] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Push Notification Permission Prompt */}
      {showNotificationPrompt && !showBanner && !showUpdateBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#20364e] text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <Bell className="h-5 w-5 shrink-0" />
            <p className="text-sm truncate">
              Ative as notificacoes para receber avisos de novos materiais
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleEnableNotifications}
              className="bg-white text-[#20364e] px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Ativar
            </button>
            <button
              onClick={handleDismissNotifications}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
