import { reactive, watch } from '@vue/reactivity'
import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'

// Register TextPlugin
gsap.registerPlugin(TextPlugin)

export async function pricing() {
  const prices = document.querySelectorAll('#ultimate-price, #pro-price, #starter-price, .comparison_header_block [data-price]');


  const euroRes = await fetch('https://subscriptions.lodgify.com/api/v2/plan-prices/EUR?numberOfRentals=200');
  const usdRes = await fetch('https://subscriptions.lodgify.com/api/v2/plan-prices/USD?numberOfRentals=200');
  const gbpRes = await fetch('https://subscriptions.lodgify.com/api/v2/plan-prices/GBP?numberOfRentals=200'); // fixed USD → GBP

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


  const state = reactive({
    units: 1, // Single number of units used for all plans
    starterPlan: 0, // Calculated price to display for starter plan
    proPlan: 0, // Calculated price to display for pro plan
    ultimatePlan: 0, // Calculated price to display for ultimate plan
    currency: 'usd',
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
  }

  function updatePriceState() {
    state.starterPlan =
      pricesData[state.currency.toLowerCase()]
        .plans?.find(p => p.type === 'NewBasic')
        .recurrences?.find(r => r.type === state.currentTimeFrame)
        .prices?.find(p => p.unit === state.units)
        .unitPrice - 1

    state.proPlan =
      pricesData[state.currency.toLowerCase()]
        ?.plans?.find(p => p.type === 'Professional')
        ?.recurrences?.find(r => r.type === state.currentTimeFrame)
        ?.prices?.find(p => p.unit === state.units)
        ?.unitPrice - 1

    state.ultimatePlan =
      pricesData[state.currency.toLowerCase()]
        ?.plans?.find(p => p.type === 'Ultimate')
        ?.recurrences?.find(r => r.type === state.currentTimeFrame)
        ?.prices?.find(p => p.unit === state.units)
        ?.unitPrice - 1
  }

  document.querySelectorAll('[data-change-currency]').forEach((e) => {
    e.addEventListener('click', () => {
      state.currency = e.getAttribute('data-change-currency')
    })
  })

  document.querySelectorAll('[data-change-unit]').forEach((e) => {
    e.addEventListener('click', () => {
      if (e.getAttribute('data-change-unit') === 'plus') {
        state.units !== 200 ? state.units++ : null
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