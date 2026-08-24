'use client'

import { useEffect } from 'react'
import { trackingService } from '@/lib/tracking/trackingClient'

const ACTION_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  'input[type="button"]',
  'input[type="submit"]',
].join(',')

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function controlLabel(element) {
  return cleanText(
    element.dataset.trackLabel
      || element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.value
      || element.textContent
      || element.id
      || element.tagName.toLowerCase(),
  )
}

function navigationTarget(element) {
  const href = element.getAttribute('href')
  if (!href) return ''

  try {
    const url = new URL(href, window.location.origin)
    return url.origin === window.location.origin ? url.pathname : url.hostname
  } catch {
    return cleanText(href)
  }
}

function interactionContext(element) {
  if (element.closest('nav')) return 'navigation'
  if (element.closest('header')) return 'header'
  if (element.closest('footer')) return 'footer'
  if (element.closest('[role="dialog"]')) return 'dialog'
  if (element.closest('form')) return 'form'
  return 'page'
}

function clickEventName(element) {
  const role = element.getAttribute('role')
  if (role === 'menuitem') return 'clicked_menu_item'
  if (role === 'tab') return 'clicked_tab'
  if (element.getAttribute('aria-haspopup') === 'menu') return 'clicked_menu_button'
  if (element.matches('a[href]') || element.closest('nav')) return 'clicked_navigation'
  return 'clicked_button'
}

export default function InteractionTracker() {
  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(ACTION_SELECTOR)
        : null

      if (!target || target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true') return

      const label = controlLabel(target)
      trackingService.trackEvent(clickEventName(target), {
        value: label,
        label,
        control_type: target.getAttribute('role') || target.tagName.toLowerCase(),
        context: interactionContext(target),
        destination: navigationTarget(target),
        element_id: cleanText(target.id),
        expanded: target.hasAttribute('aria-expanded')
          ? target.getAttribute('aria-expanded') === 'true'
          : undefined,
        source: 'global_interaction_tracker',
      })
    }

    const handleChange = (event) => {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)
        && !(target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type))) return

      const label = cleanText(
        target.getAttribute('aria-label')
          || target.labels?.[0]?.textContent
          || target.name
          || target.id,
      )

      trackingService.trackEvent('changed_form_control', {
        value: target instanceof HTMLSelectElement ? cleanText(target.value) : String(target.checked),
        label,
        control_type: target instanceof HTMLSelectElement ? 'select' : target.type,
        context: interactionContext(target),
        source: 'global_interaction_tracker',
      })
    }

    const handleSubmit = (event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      const label = cleanText(form.getAttribute('aria-label') || form.name || form.id || 'form')
      trackingService.trackEvent('submitted_form', {
        value: label,
        label,
        source: 'global_interaction_tracker',
      })
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('change', handleChange)
    document.addEventListener('submit', handleSubmit)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('change', handleChange)
      document.removeEventListener('submit', handleSubmit)
    }
  }, [])

  return null
}
