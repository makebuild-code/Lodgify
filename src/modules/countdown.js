export function countdown() {
  // Target date: November 28th of current year (or next year if already passed)
  const now = new Date()
  const currentYear = now.getFullYear()
  let targetDate = new Date(currentYear, 10, 28) // Month is 0-indexed, so 10 = November

  // If November 28th has already passed this year, use next year
  if (targetDate < now) {
    targetDate = new Date(currentYear + 1, 10, 28)
  }

  // Get all countdown elements
  const daysElement = document.querySelector('[data-countdown="days"]')
  const hoursElement = document.querySelector('[data-countdown="hours"]')
  const minutesElement = document.querySelector('[data-countdown="minutes"]')
  const secondsElement = document.querySelector('[data-countdown="seconds"]')
  const generalElement = document.querySelector('[data-countdown=""]')

  // Function to update countdown display
  function updateCountdown() {
    const now = new Date()
    const timeRemaining = targetDate - now

    // If countdown has reached zero or passed
    if (timeRemaining <= 0) {
      if (daysElement) daysElement.textContent = '0'
      if (hoursElement) hoursElement.textContent = '0'
      if (minutesElement) minutesElement.textContent = '0'
      if (secondsElement) secondsElement.textContent = '0'
      return
    }

    // Calculate time components
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

    // Update DOM elements
    if (daysElement) daysElement.textContent = String(days)
    if (hoursElement) hoursElement.textContent = String(hours).padStart(2, '0')
    if (minutesElement) minutesElement.textContent = String(minutes).padStart(2, '0')
    if (secondsElement) secondsElement.textContent = String(seconds).padStart(2, '0')
  }

  // Update immediately
  updateCountdown()

  // Update every second
  setInterval(updateCountdown, 1000)
}

