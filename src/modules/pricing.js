import { reactive, watch } from '@vue/reactivity'
import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'

// Register TextPlugin
gsap.registerPlugin(TextPlugin)

export async function pricing() {
  // Discount percentage config from data attributes
  const DISCOUNT_PERCENTAGE_YEARLY = parseFloat(document.querySelector('[data-saving-yearly]')?.getAttribute('data-saving-yearly') || '0')
  const DISCOUNT_PERCENTAGE_BIYEAR = parseFloat(document.querySelector('[data-saving-biyearly]')?.getAttribute('data-saving-biyearly') || '0')

  const prices = document.querySelectorAll('#ultimate-price, #pro-price, #starter-price, .comparison_header_block [data-price]');

  // Determine base URL based on current hostname
  const currentHostname = window.location.hostname;
  let baseUrl;

  if (currentHostname.includes('lodgify.com')) {
    baseUrl = 'https://subscriptions.lodgify.com';
  } else if (currentHostname.includes('lodgifyintegrations.com')) {
    baseUrl = 'https://subscriptions.lodgifyintegration.com';
  } else {
    // Default fallback
    baseUrl = 'https://subscriptions.lodgifyintegration.com';
  }

  const euroRes = await fetch(`${baseUrl}/api/v2/plan-prices/eur?numberOfRentals=100`);
  const usdRes = await fetch(`${baseUrl}/api/v2/plan-prices/usd?numberOfRentals=100`);
  const gbpRes = await fetch(`${baseUrl}/api/v2/plan-prices/gbp?numberOfRentals=100`);


  const [euroPrices, usdPrices, gbpPrices] = await Promise.all([
    euroRes.json(),
    usdRes.json(),
    gbpRes.json()
  ]);



  const pricesData = {
    eur: euroPrices,
    usd: usdPrices,
    gbp: gbpPrices
  };

  // Check HTML lang attribute to determine initial currency
  const htmlLang = document.documentElement.lang || ''
  const euroLocales = ['es-ES', 'fr-FR', 'pt-PT', 'de-DE', 'it-IT']
  const initialCurrency = euroLocales.includes(htmlLang) ? 'eur' : 'usd'

  const state = reactive({
    units: 1, // Single number of units used for all plans
    starterPlan: 0, // Calculated price to display for starter plan
    proPlan: 0, // Calculated price to display for pro plan
    ultimatePlan: 0, // Calculated price to display for ultimate plan
    starterMonthlyPrice: 0, // Monthly price for starter plan (for original price calculation)
    proMonthlyPrice: 0, // Monthly price for pro plan (for original price calculation)
    ultimateMonthlyPrice: 0, // Monthly price for ultimate plan (for original price calculation)
    currency: initialCurrency,
    currentTimeFrame: 'Yearly'
  })


  const currencies = {
    eur: '€',
    gbp: '£',
    usd: '$'
  }

  watch(
    () => {
      return [state.units, state.currency, state.currentTimeFrame]
    }
    , (newstate) => {
      updatePriceState()
      updatePage()
    })

  function getDivision() {
    if (state.currentTimeFrame === 'Yearly') {
      return 12
    } else if (state.currentTimeFrame === 'BiYearly') {
      return 24
    } else if (state.currentTimeFrame === 'Monthly') {
      return 1
    }
  }

  // Update DOM with current prices from state
  function updatePage() {
    // Set opacity for .pricing_price elements in pro and ultimate plans only
    const pricingPriceElements = document.querySelectorAll('[data-pricing="pro"] .pricing_price, [data-pricing="ultimate"] .pricing_price')

    if (state.currentTimeFrame === 'Monthly') {
      pricingPriceElements.forEach((e) => {
        e.style.opacity = '0'
      })
    } else if (state.currentTimeFrame === 'Yearly' || state.currentTimeFrame === 'BiYearly') {
      pricingPriceElements.forEach((e) => {
        e.style.opacity = '1'
      })
    }
    // update all the prices with GSAP text animation
    prices.forEach((e) => {
      let element = e.querySelector('strong')
      if (!element) return

      let targetValue
      if (e.getAttribute('id') === 'starter-price' || e.getAttribute('data-price') === 'starter') {
        targetValue = Math.round(state.starterPlan / getDivision())
      } else if (e.getAttribute('id') === 'ultimate-price' || e.getAttribute('data-price') === 'ultimate') {
        targetValue = Math.round(state.ultimatePlan / getDivision())
      } else if (e.getAttribute('id') === 'pro-price' || e.getAttribute('data-price') === 'pro') {
        targetValue = Math.round(state.proPlan / getDivision())
      } else {
        return
      }

      // Get current value
      const currentValue = parseInt(element.textContent) || 0

      // Create an object to animate
      const counter = { value: currentValue }

      // Animate text change counting up 1 by 1
      gsap.to(counter, {
        value: targetValue,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: function () {
          // Round to nearest integer and update text (counts up 1 by 1)
          element.textContent = Math.round(counter.value)
        }
      })
    })

    document.querySelectorAll('[data-currency]').forEach((e) => {
      e.textContent = currencies[state.currency.toLowerCase()]
    });

    document.querySelectorAll('[data-change-currency]').forEach((e) => {
      e.classList.remove('is-active')
    })

    document.querySelector(`[data-change-currency="${state.currency}"]`).classList.add('is-active');

    document.querySelectorAll('[data-change-timeframe]').forEach((e) => {
      e.classList.remove('is-active')
    })
    document.querySelector(`[data-change-timeframe="${state.currentTimeFrame}"]`).classList.add('is-active');


    document.querySelector('[data-unit]').innerHTML = String(state.units).padStart(2, '0');

    // Update original prices (before discount) for [data-original] elements
    document.querySelectorAll('[data-original]').forEach((e) => {
      let element = e.querySelector('strong')
      if (!element) element = e // If no strong tag, use the element itself

      let originalPrice
      const planType = e.getAttribute('data-original')

      // Calculate original price based on timeframe
      if (state.currentTimeFrame === 'Monthly') {
        // No discount for monthly, same as displayed
        if (planType === 'starter') {
          originalPrice = Math.round(state.starterMonthlyPrice)
        } else if (planType === 'pro') {
          originalPrice = Math.round(state.proMonthlyPrice)
        } else if (planType === 'ultimate') {
          originalPrice = Math.round(state.ultimateMonthlyPrice)
        } else {
          return
        }
      } else if (state.currentTimeFrame === 'Yearly') {
        // Original price before discount
        if (planType === 'starter') {
          originalPrice = Math.round((state.starterMonthlyPrice * 12))
        } else if (planType === 'pro') {
          originalPrice = Math.round((state.proMonthlyPrice * 12))
        } else if (planType === 'ultimate') {
          originalPrice = Math.round((state.ultimateMonthlyPrice * 12))
        } else {
          return
        }
      } else if (state.currentTimeFrame === 'BiYearly') {
        // Original price before discount
        if (planType === 'starter') {
          originalPrice = Math.round((state.starterMonthlyPrice * 24))
        } else if (planType === 'pro') {
          originalPrice = Math.round((state.proMonthlyPrice * 24))
        } else if (planType === 'ultimate') {
          originalPrice = Math.round((state.ultimateMonthlyPrice * 24))
        } else {
          return
        }
      } else {
        return
      }

      // Convert to monthly equivalent for display
      const targetValue = Math.round(originalPrice / getDivision())

      // Get current value
      const currentValue = parseInt(element.textContent) || 0

      // Create an object to animate
      const counter = { value: currentValue }

      // Animate text change counting up 1 by 1
      gsap.to(counter, {
        value: targetValue,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: function () {
          // Round to nearest integer and update text (counts up 1 by 1)
          element.textContent = Math.round(counter.value)
        }
      })
    })
  }

  function updatePriceState() {
    // Get all prices from API for starter plan
    const starterPlan = pricesData[state.currency.toLowerCase()]
      .plans?.find(p => p.type === 'NewBasic')

    const starterMonthlyPrice = starterPlan
      .recurrences?.find(r => r.type === 'Monthly')
      .prices?.find(p => p.unit === state.units)
      .unitPrice

    const starterYearlyPrice = starterPlan
      .recurrences?.find(r => r.type === 'Yearly')
      .prices?.find(p => p.unit === state.units)
      .unitPrice

    const starterBiYearlyPrice = starterPlan
      .recurrences?.find(r => r.type === 'BiYearly')
      .prices?.find(p => p.unit === state.units)
      .unitPrice

    // Always get monthly prices from API for pro and ultimate
    const proMonthlyPrice = pricesData[state.currency.toLowerCase()]
      ?.plans?.find(p => p.type === 'Professional')
      ?.recurrences?.find(r => r.type === 'Monthly')
      ?.prices?.find(p => p.unit === state.units)
      ?.unitPrice

    const ultimateMonthlyPrice = pricesData[state.currency.toLowerCase()]
      ?.plans?.find(p => p.type === 'Ultimate')
      ?.recurrences?.find(r => r.type === 'Monthly')
      ?.prices?.find(p => p.unit === state.units)
      ?.unitPrice

    // Store monthly prices for original price calculation
    state.starterMonthlyPrice = starterMonthlyPrice
    state.proMonthlyPrice = proMonthlyPrice
    state.ultimateMonthlyPrice = ultimateMonthlyPrice

    // Calculate prices based on timeframe with discount
    // Starter plan pulls all prices directly from API
    if (state.currentTimeFrame === 'Monthly') {
      state.starterPlan = Math.round(starterMonthlyPrice)
      state.proPlan = Math.round(proMonthlyPrice)
      state.ultimatePlan = Math.round(ultimateMonthlyPrice)
    } else if (state.currentTimeFrame === 'Yearly') {
      state.starterPlan = Math.round(starterYearlyPrice) // From API
      state.proPlan = Math.round((proMonthlyPrice * 12) * (1 - DISCOUNT_PERCENTAGE_YEARLY / 100))
      state.ultimatePlan = Math.round((ultimateMonthlyPrice * 12) * (1 - DISCOUNT_PERCENTAGE_YEARLY / 100))
    } else if (state.currentTimeFrame === 'BiYearly') {
      state.starterPlan = Math.round(starterBiYearlyPrice) // From API
      state.proPlan = Math.round((proMonthlyPrice * 24) * (1 - DISCOUNT_PERCENTAGE_BIYEAR / 100))
      state.ultimatePlan = Math.round((ultimateMonthlyPrice * 24) * (1 - DISCOUNT_PERCENTAGE_BIYEAR / 100))
    }
  }

  document.querySelectorAll('[data-change-currency]').forEach((e) => {
    e.addEventListener('click', () => {
      state.currency = e.getAttribute('data-change-currency')
    })
  })

  document.querySelectorAll('[data-change-unit]').forEach((e) => {
    e.addEventListener('click', () => {
      if (e.getAttribute('data-change-unit') === 'plus') {
        state.units !== 100 ? state.units++ : null
      } else if (e.getAttribute('data-change-unit') === 'minus') {
        state.units !== 1 ? state.units-- : null
      }
    })
  })

  document.querySelectorAll('[data-change-timeframe]').forEach((e) => {
    e.addEventListener('click', () => {
      state.currentTimeFrame = e.getAttribute('data-change-timeframe')
    })
  })

  // Call on initial load
  wrapCurrencySigns()

  updatePriceState()
  updatePage()

}

// Wrap all dollar signs in spans with data-currency attribute
function wrapCurrencySigns() {

  // Find target containers
  const compareWrap = document.querySelector('.compare_wrap')
  const pricingWrap = document.querySelector('.pricing_wrap')

  const containers = []
  if (compareWrap) containers.push(compareWrap)
  if (pricingWrap) containers.push(pricingWrap)

  if (!containers.length) return

  const textNodes = []

  // Process each container
  containers.forEach(container => {
    // Get all text nodes within this container
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    )

    let node
    while ((node = walker.nextNode())) {
      if (node.textContent.includes('$')) {
        textNodes.push(node)
      }
    }
  })

  // Process each text node containing $
  textNodes.forEach(textNode => {
    const parent = textNode.parentNode
    const text = textNode.textContent

    // Split text by $ and create fragments
    const parts = text.split('$')
    const fragment = document.createDocumentFragment()

    for (let i = 0; i < parts.length; i++) {
      // Add text before $
      if (parts[i]) {
        fragment.appendChild(document.createTextNode(parts[i]))
      }

      // Add wrapped $ sign (except after last part)
      if (i < parts.length - 1) {
        const span = document.createElement('span')
        span.setAttribute('data-currency', '$')
        span.textContent = '$'
        fragment.appendChild(span)
      }
    }

    // Replace the original text node
    parent.replaceChild(fragment, textNode)
  })
}