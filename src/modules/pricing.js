import { reactive, watch } from '@vue/reactivity'
import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'

// Register TextPlugin
gsap.registerPlugin(TextPlugin);

export async function pricing() {

  const prices = document.querySelectorAll('#ultimate-price, #pro-price, #starter-no-fee-price, #starter-fee-price, #slim-price, .comparison_header_block [data-price]');

  // Loader state for initial fetch/render to avoid flashing stale values
  let initialLoad = true

  document.documentElement.classList.add('js');
  const wrap = document.querySelector('.pricing_cards_container')
  wrap.style.opacity = '0';

  function showWrap() {
    try {
      wrap.style.opacity = '1';

    } catch (err) {
      return;
    }
  }

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
  // Fetch prices with error handling and normalise responses.
  let pricesData = { eur: null, usd: null, gbp: null }
  // Cached canonical plans for the selected currency to avoid double-normalising
  // during a single update cycle (updatePriceState -> updatePage).
  let canonicalPlans = {}
  // Show loader while we fetch & compute initial prices
  try {
    // Start with numberOfRentals always set to 100
    const params = new URLSearchParams({ numberOfRentals: '100' });

    // Read URL parameters from staging site
    const urlParams = new URLSearchParams(window.location.search);

    // Only add country and region if they're in the URL
    if (urlParams.has('country')) {
      params.set('country', urlParams.get('country'));
    }
    if (urlParams.has('region')) {
      params.set('region', urlParams.get('region'));
    }

    const queryString = params.toString();

    const [euroRes, usdRes, gbpRes] = await Promise.all([
      fetch(`${baseUrl}/api/v3/plan-prices/eur?${queryString}`),
      fetch(`${baseUrl}/api/v3/plan-prices/usd?${queryString}`),
      fetch(`${baseUrl}/api/v3/plan-prices/gbp?${queryString}`)
    ]);

    if (!euroRes.ok || !usdRes.ok || !gbpRes.ok) {
      throw new Error('One or more price endpoints returned non-OK status')
    }

    const [euroPrices, usdPrices, gbpPrices] = await Promise.all([
      euroRes.json(),
      usdRes.json(),
      gbpRes.json()
    ])

    pricesData = { eur: euroPrices, usd: usdPrices, gbp: gbpPrices }
  } catch (err) {
    console.error('Failed to fetch or parse pricing data', err)
  }

  // Helper: map variable API plan type names to canonical keys used by the UI
  const PLAN_TYPE_MAP = {
    'Slim': 'slim',
    'NewBasic': 'starter-fee',
    'StarterNoFee': 'starter-no-fee',
    'Professional': 'pro',
    'Ultimate': 'ultimate'
  }

  // Helper: normalise plans array into an object keyed by canonical plan keys
  function mapPlansToCanonical(plans = []) {
    const mapped = {}
    if (!Array.isArray(plans)) return mapped
    plans.forEach(plan => {
      const key = PLAN_TYPE_MAP[plan.type] || plan.type
      mapped[key] = plan
    })
    return mapped
  }

  // Helper: choose a sensible unit price from a prices array for a given units value
  function choosePriceForUnits(prices = [], units = 1) {
    if (!Array.isArray(prices) || prices.length === 0) return null;
    const parsed = prices
      .map(p => ({ unit: Number(p.unit), unitPrice: Number(p.unitPrice) }))
      .filter(p => Number.isFinite(p.unit) && Number.isFinite(p.unitPrice));

    const exact = parsed.find(p => p.unit === Number(units));
    if (exact) {
      return exact.unitPrice;
    } else {
      return null;
    }

  }

  // Helper: get unit price safely from a plan's recurrences
  function getUnitPrice(plan, recurrenceType, units) {
    if (!plan || !Array.isArray(plan.recurrences)) return null
    const recurrence = plan.recurrences.find(r => r.type === recurrenceType)
    if (!recurrence || !Array.isArray(recurrence.prices)) return null
    return choosePriceForUnits(recurrence.prices, units)
  }

  // Create a normalised view of the fetched prices for the selected currency
  function getNormalisedPricesForCurrency(currencyKey) {
    const raw = pricesData[currencyKey]
    if (!raw || !Array.isArray(raw.plans)) return {}
    return mapPlansToCanonical(raw.plans)
  }


  // Check HTML lang attribute to determine initial currency
  const htmlLang = document.documentElement.lang || ''
  const euroLocales = ['es-ES', 'fr-FR', 'pt-PT', 'de-DE', 'it-IT']
  const initialCurrency = euroLocales.includes(htmlLang) ? 'eur' : 'usd'

  const state = reactive({
    units: 1, // Single number of units used for all plans
    slimPlan: null, // Calculated price to display for slim plan
    starterFeePlan: null, // Calculated price to display for starter plan
    starterNoFeePlan: null, // Calculated price to display for starter no-fee plan
    proPlan: null, // Calculated price to display for pro plan
    ultimatePlan: null, // Calculated price to display for ultimate plan
    slimMonthlyPrice: null, // Monthly price for slim plan (for original price calculation)
    starterMonthlyPrice: null, // Monthly price for starter plan (for original price calculation)
    starterNoFeeMonthlyPrice: null, // Monthly price for starter no-fee plan (for original price calculation)
    proMonthlyPrice: null, // Monthly price for pro plan (for original price calculation)
    ultimateMonthlyPrice: null, // Monthly price for ultimate plan (for original price calculation)
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
    const pricingPriceElements = document.querySelectorAll('[data-pricing="pro"] .pricing_price-no-border, [data-pricing="ultimate"] .pricing_price-no-border,  [data-pricing="starter-fee"] .pricing_price-no-border, [data-pricing="starter-no-fee"] .pricing_price-no-border, [data-pricing="slim"] .pricing_price-no-border')

    try {
      const canonical = canonicalPlans

      pricingPriceElements.forEach((e) => {
        const planRoot = e.closest('[data-pricing]')
        const planKey = planRoot ? planRoot.getAttribute('data-pricing') : null

        // Determine whether this plan has an exact unit price for the selected units
        let hasExactUnitPrice = true // default to true so unknown plans don't get hidden unexpectedly
        if (planKey && canonical) {
          const plan = canonical[planKey] || null
          const monthly = getUnitPrice(plan, 'Monthly', state.units)
          const yearly = getUnitPrice(plan, 'Yearly', state.units)
          const biyearly = getUnitPrice(plan, 'BiYearly', state.units)
          hasExactUnitPrice = Number.isFinite(monthly) || Number.isFinite(yearly) || Number.isFinite(biyearly)
        }

        if (state.currentTimeFrame === 'Monthly' || !hasExactUnitPrice) {
          e.style.opacity = '0'
        } else {
          e.style.opacity = '1'
        }
      })
    } catch (err) {
      console.warn('Failed to update pricing price element opacity', err)
    }

    // Hide or show plan slots based on what the API returned for this currency.
    try {
      const raw = pricesData[state.currency.toLowerCase()]
      const returned = new Set()
      if (raw && Array.isArray(raw.plans)) {
        raw.plans.forEach(p => {
          const mapped = PLAN_TYPE_MAP[p.type] || p.type
          returned.add(mapped)
        })
      }

      const planAttrs = ['slim', 'starter-fee', 'starter-no-fee', 'pro', 'ultimate']
      planAttrs.forEach(attr => {
        document.querySelectorAll(`[data-pricing="${attr}"]`).forEach(node => {
          // If API returned no plans at all, keep slots hidden; otherwise show only returned ones
          if (!returned.size || !returned.has(attr)) {
            node.style.display = 'none'
          } else {
            node.style.display = ''
          }
        })
      })
    } catch (err) {
      console.warn('Failed to toggle plan slot visibility', err)
    }
    // update all the prices with GSAP text animation
    prices.forEach((e) => {
      let element = e.querySelector('strong')
      if (!element) return

      let targetValue
      // Helper to read per-card discount attribute for the current timeframe
      function readCardDiscount(el, timeframe) {
        try {
          if (timeframe === 'Yearly') {
            const n = el.closest('[data-discount-yearly]')
            return n ? parseFloat(n.getAttribute('data-discount-yearly')) || 0 : 0
          } else if (timeframe === 'BiYearly') {
            const n = el.closest('[data-discount-biyearly]')
            return n ? parseFloat(n.getAttribute('data-discount-biyearly')) || 0 : 0
          }
        } catch (err) {
          return 0
        }
        return 0
      }

      // Determine the raw total for the current timeframe
      let rawTotal = null
      if (e.getAttribute('id') === 'slim-price' || e.getAttribute('data-price') === 'slim') {
        rawTotal = Number.isFinite(state.slimPlan) ? state.slimPlan : null
      } else if (e.getAttribute('id') === 'starter-fee-price' || e.getAttribute('data-price') === 'starter-fee') {
        rawTotal = Number.isFinite(state.starterFeePlan) ? state.starterFeePlan : null
      } else if (e.getAttribute('id') === 'starter-no-fee-price' || e.getAttribute('data-price') === 'starter-no-fee') {
        rawTotal = Number.isFinite(state.starterNoFeePlan) ? state.starterNoFeePlan : null
      } else if (e.getAttribute('id') === 'ultimate-price' || e.getAttribute('data-price') === 'ultimate') {
        rawTotal = Number.isFinite(state.ultimatePlan) ? state.ultimatePlan : null
      } else if (e.getAttribute('id') === 'pro-price' || e.getAttribute('data-price') === 'pro') {
        rawTotal = Number.isFinite(state.proPlan) ? state.proPlan : null
      } else {
        return
      }

      if (rawTotal === null) {
        targetValue = null
      } else {
        const discountPercent = readCardDiscount(e, state.currentTimeFrame) || 0

        // Try to read the underlying monthly unit price for this card/plan.
        let monthlyUnit = null
        if (e.getAttribute('id') === 'slim-price' || e.getAttribute('data-price') === 'slim') {
          monthlyUnit = Number.isFinite(state.slimMonthlyPrice) ? state.slimMonthlyPrice : null
        } else if (e.getAttribute('id') === 'starter-fee-price' || e.getAttribute('data-price') === 'starter-fee') {
          monthlyUnit = Number.isFinite(state.starterMonthlyPrice) ? state.starterMonthlyPrice : null
        } else if (e.getAttribute('id') === 'starter-no-fee-price' || e.getAttribute('data-price') === 'starter-no-fee') {
          monthlyUnit = Number.isFinite(state.starterNoFeeMonthlyPrice) ? state.starterNoFeeMonthlyPrice : null
        } else if (e.getAttribute('id') === 'ultimate-price' || e.getAttribute('data-price') === 'ultimate') {
          monthlyUnit = Number.isFinite(state.ultimateMonthlyPrice) ? state.ultimateMonthlyPrice : null
        } else if (e.getAttribute('id') === 'pro-price' || e.getAttribute('data-price') === 'pro') {
          monthlyUnit = Number.isFinite(state.proMonthlyPrice) ? state.proMonthlyPrice : null
        }

        if (discountPercent > 0 && monthlyUnit !== null) {
          // Apply discount to the monthly unit price
          const discountedMonthly = Math.round(monthlyUnit * (1 - (discountPercent / 100)))
          // The UI expects a monthly-equivalent value, so use discountedMonthly directly
          targetValue = discountedMonthly
        } else {
          // Fallback to previous behaviour: apply discount to the timeframe total,
          // then convert to monthly-equivalent for display.
          if (state.currentTimeFrame === 'Monthly') {
            targetValue = Math.round(rawTotal)
          } else {
            const discountedTotal = Math.round(rawTotal * (1 - (discountPercent / 100)))
            targetValue = Math.round(discountedTotal / getDivision())
          }
        }
        // Update the percent badge on the card: default 20 for Yearly, 25 for BiYearly,
        // but if the card has a `data-discount-yearly` / `data-discount-biyearly` attribute
        // use that value instead.
        try {
          const planRoot = e.closest('[data-pricing]') || e
          const percentSpan = planRoot ? planRoot.querySelector('[data-percent]') : null
          if (percentSpan) {
            if (state.currentTimeFrame === 'Monthly') {
              percentSpan.textContent = ''
            } else if (state.currentTimeFrame === 'Yearly') {
              const attr = planRoot.getAttribute('data-discount-yearly')
              const pct = attr !== null ? parseFloat(attr) : 20
              percentSpan.textContent = Number.isFinite(pct) ? String(Math.round(pct)) : '20'
            } else if (state.currentTimeFrame === 'BiYearly') {
              // Display: prefer the Yearly attribute if present, otherwise use
              // the biyearly attribute if present, otherwise default to 25.
              const yearlyAttr = planRoot.getAttribute('data-discount-yearly')
              if (yearlyAttr !== null) {
                const pct = parseFloat(yearlyAttr)
                percentSpan.textContent = Number.isFinite(pct) ? String(Math.round(pct)) : '25'
              } else {
                const biyearlyAttr = planRoot.getAttribute('data-discount-biyearly')
                const pct = biyearlyAttr !== null ? parseFloat(biyearlyAttr) : 25
                percentSpan.textContent = Number.isFinite(pct) ? String(Math.round(pct)) : '25'
              }
            }
          }
        } catch (err) {
          console.warn('Failed to set percent badge for plan', err)
        }
      }

      // Get current value
      const currentValue = parseInt(element.textContent) || 0;

      // Create an object to animate (or set directly on first load)
      const counter = { value: currentValue }

      if (initialLoad) {
        // On first render avoid animation — set stable final text immediately
        if (targetValue === null || typeof targetValue === 'undefined' || !Number.isFinite(targetValue)) {
          element.textContent = '-'
        } else {
          element.textContent = String(Math.round(targetValue))
        }
      } else {
        // Animate text change counting up 1 by 1
        if (targetValue === null || typeof targetValue === 'undefined' || !Number.isFinite(targetValue)) {
          element.textContent = '-'
        } else {
          gsap.to(counter, {
            value: targetValue,
            duration: 0.5,
            ease: 'power2.out',
            onUpdate: function () {
              // Round to nearest integer and update text (counts up 1 by 1)
              element.textContent = Math.round(counter.value)
            }
          })
        }
      }
    })

    document.querySelectorAll('[data-currency]').forEach((e) => {
      e.textContent = currencies[state.currency.toLowerCase()]
    });

    try {
      if (state.currency && state.currency.toLowerCase() === 'eur') {
        prices.forEach((container) => {
          const strong = container.querySelector('strong')
          const span = container.querySelector('[data-currency]')
          if (!strong || !span) return
          // Move span to directly after the strong element
          span.remove()
          if (strong.nextSibling) {
            strong.parentNode.insertBefore(span, strong.nextSibling)
          } else {
            strong.parentNode.appendChild(span)
          }
        })
      } else {
        prices.forEach((container) => {
          const strong = container.querySelector('strong')
          const span = container.querySelector('[data-currency]')
          if (!strong || !span) return
          // Ensure span appears immediately before the strong element
          span.remove()
          strong.parentNode.insertBefore(span, strong)
        })
      }
    } catch (err) {
      console.warn('Failed to reposition currency spans', err)
    }

    document.querySelectorAll('[data-change-currency]').forEach((e) => {
      e.classList.remove('is-active')
    })

    document.querySelector(`[data-change-currency="${state.currency}"]`).classList.add('is-active');

    document.querySelectorAll('[data-change-timeframe]').forEach((e) => {
      e.classList.remove('is-active')
    })
    document.querySelector(`[data-change-timeframe="${state.currentTimeFrame}"]`).classList.add('is-active');


    document.querySelector('[data-unit]').textContent = String(state.units).padStart(2, '0');

    // Update original prices (before discount) for [data-original] elements
    document.querySelectorAll('[data-original]').forEach((e) => {
      let element = e.querySelector('strong')
      if (!element) element = e // If no strong tag, use the element itself

      const planType = e.getAttribute('data-original')

      // Helper: map data-original value to the monthly price state field
      function monthlyPriceForPlan(type) {
        if (type === 'starter-no-fee') return state.starterNoFeeMonthlyPrice
        if (type === 'starter-fee') return state.starterMonthlyPrice
        if (type === 'pro' || type === 'professional') return state.proMonthlyPrice
        if (type === 'ultimate') return state.ultimateMonthlyPrice
        if (type === 'slim') return state.slimMonthlyPrice
        return null
      }

      const monthly = monthlyPriceForPlan(planType)
      if (!Number.isFinite(monthly)) {
        e.style.display = 'none'
        return
      }

      // Compute originalPrice before any discounts — yearly = monthly * 12, biyearly = monthly * 24
      let originalPrice = null
      if (state.currentTimeFrame === 'Monthly') {
        originalPrice = Math.round(monthly)
      } else if (state.currentTimeFrame === 'Yearly') {
        originalPrice = Math.round(monthly * 12)
      } else if (state.currentTimeFrame === 'BiYearly') {
        originalPrice = Math.round(monthly * 24)
      }

      if (originalPrice === null) {
        e.style.display = 'none'
        return
      }

      e.style.display = ''

      // Convert to monthly equivalent for display
      const targetValue = Math.round(originalPrice / getDivision())

      // Get current value
      const currentValue = parseInt(element.textContent) || 0

      // Create an object to animate
      const counter = { value: currentValue }
      // Animate text change counting up 1 by 1 — on initial load set directly
      if (initialLoad) {
        if (targetValue === null || typeof targetValue === 'undefined' || !Number.isFinite(targetValue)) {
          element.textContent = '-'
        } else {
          element.textContent = String(Math.round(targetValue))
        }
      } else {
        if (targetValue === null || typeof targetValue === 'undefined' || !Number.isFinite(targetValue)) {
          element.textContent = '-'
        } else {
          gsap.to(counter, {
            value: targetValue,
            duration: 0.5,
            ease: 'power2.out',
            onUpdate: function () {
              // Round to nearest integer and update text (counts up 1 by 1)
              element.textContent = Math.round(counter.value)
            }
          })
        }
      }
    })

    // After first render, hide the loader to reveal stable values
    try {
      if (initialLoad) {
        initialLoad = false
        showWrap()
      }
    } catch (err) {
      console.warn('Failed to hide initial pricing loader', err)
    }
  }

  function updatePriceState() {
    try {
      const currencyKey = state.currency.toLowerCase()
      const canonical = getNormalisedPricesForCurrency(currencyKey)
      canonicalPlans = canonical || {}

      const planDefs = [
        { key: 'starter-fee', monthlyField: 'starterMonthlyPrice', planField: 'starterFeePlan' },
        { key: 'starter-no-fee', monthlyField: 'starterNoFeeMonthlyPrice', planField: 'starterNoFeePlan' },
        { key: 'pro', monthlyField: 'proMonthlyPrice', planField: 'proPlan' },
        { key: 'ultimate', monthlyField: 'ultimateMonthlyPrice', planField: 'ultimatePlan' },
        { key: 'slim', monthlyField: 'slimMonthlyPrice', planField: 'slimPlan' }
      ]

      // Helper to compute the displayed value for the current timeframe
      function computeDisplayedValue(monthly, yearly, biyearly) {
        if (state.currentTimeFrame === 'Monthly') {
          return Number.isFinite(monthly) ? Math.round(monthly) : null
        } else if (state.currentTimeFrame === 'Yearly') {
          return Number.isFinite(yearly) ? Math.round(yearly) : (Number.isFinite(monthly) ? Math.round(monthly * 12) : null)
        } else if (state.currentTimeFrame === 'BiYearly') {
          return Number.isFinite(biyearly) ? Math.round(biyearly) : (Number.isFinite(monthly) ? Math.round(monthly * 24) : null)
        }
        return null
      }

      // Compute and assign monthly prices and plan totals in a loop to avoid repetition
      planDefs.forEach(def => {
        const plan = canonical[def.key] || null

        const monthly = getUnitPrice(plan, 'Monthly', state.units)
        const yearly = getUnitPrice(plan, 'Yearly', state.units)
        const biyearly = getUnitPrice(plan, 'BiYearly', state.units)

        // Store monthly prices on state (used for original price computations)
        state[def.monthlyField] = monthly

        // Compute and store the displayed plan total based on current timeframe
        const displayed = computeDisplayedValue(monthly, yearly, biyearly)
        state[def.planField] = Number.isFinite(displayed) ? Math.round(displayed) : null


        try {
          const hasAny = Number.isFinite(monthly) || Number.isFinite(yearly) || Number.isFinite(biyearly)
          document.querySelectorAll(`[data-pricing="${def.key}"]`).forEach(node => {
            // Update CTA text when exact unit isn't available but a lower tier exists.
            try {
              // Only add the limited-note for the first DOM instance of this data-pricing
              const firstNode = document.querySelector(`[data-pricing="${def.key}"]`)
              const isFirstInstance = node === firstNode

              // collect available unit numbers from all recurrences for this plan
              const availableUnits = new Set()
              if (plan && Array.isArray(plan.recurrences)) {
                plan.recurrences.forEach(r => {
                  if (Array.isArray(r.prices)) {
                    r.prices.forEach(p => {
                      const n = Number(p.unit)
                      if (Number.isFinite(n)) availableUnits.add(n)
                    })
                  }
                })
              }

              const requested = Number(state.units)
              let nearestLower = null
              for (const u of Array.from(availableUnits).sort((a, b) => a - b)) {
                if (u < requested) nearestLower = u
                if (u >= requested) break
              }

              if (nearestLower !== null && !Number.isFinite(monthly)) {

                // Don't run this block for nodes inside comparison detail blocks
                if (node.closest && node.closest('.compare_detail_wrap')) return;

                const label = `Max ${nearestLower} ${nearestLower === 1 ? 'property' : 'properties'}`;
                const buttonContainer = node.querySelector('.button_main_text');
                let buttonTextEl = buttonContainer ? buttonContainer.querySelector('strong') : null;
                if (!buttonTextEl) buttonTextEl = buttonContainer || node;

                // Cache original text for restore later (store only once)
                if (buttonTextEl && typeof node.dataset.originalText === 'undefined') {
                  node.dataset.originalText = (buttonTextEl.textContent || '').trim();
                }

                if (buttonTextEl) buttonTextEl.textContent = label;

                // Add or update the helper note under the button (only on first instance)
                try {
                  const noteSelector = '.plan-limited-note'
                  let noteEl = node.querySelector(noteSelector)
                  const noteText = `This plan is only available for ${nearestLower} ${nearestLower === 1 ? 'property or less' : 'properties or less'}.`
                  if (isFirstInstance) {
                    if (!noteEl) {
                      noteEl = document.createElement('span')
                      noteEl.className = 'plan-limited-note'
                      noteEl.textContent = noteText

                      noteEl.style.display = 'block';
                      noteEl.style.marginTop = '0.875rem';
                      noteEl.style.fontSize = '1rem';
                      noteEl.style.color = '#51B293';
                      noteEl.style.fontWeight = '700';

                      const buttonWrap = node.querySelector('.button_main_wrap')
                      if (buttonWrap && buttonWrap.parentNode) {
                        buttonWrap.parentNode.insertBefore(noteEl, buttonWrap.nextSibling)
                      } else if (buttonContainer && buttonContainer.parentNode) {
                        buttonContainer.parentNode.insertBefore(noteEl, buttonContainer.nextSibling)
                      } else {
                        node.appendChild(noteEl)
                      }
                    } else {
                      noteEl.textContent = noteText
                    }
                  }
                } catch (err) {
                  console.warn('Failed to add/update plan limited note', err)
                }

                // Ensure any `.pricing_price-original.in-comparison-block` within this node is hidden
                try {
                  const comparisonText = node.querySelector('.comparison_text_pricing');
                  if (comparisonText) comparisonText.style.opacity = '0.2';
                  node.querySelectorAll('.pricing_price-original.in-comparison-block').forEach(el => {
                    el.style.opacity = '0'
                  })
                } catch (err) {
                  console.warn('Failed to hide comparison original prices', err)
                }

              }
              else {
                // Restore original CTA text and remove helper note when exact tier is available
                try {
                  const buttonContainer = node.querySelector('.button_main_text')
                  let buttonTextEl = buttonContainer ? buttonContainer.querySelector('strong') : null
                  if (!buttonTextEl) buttonTextEl = buttonContainer || node

                  if (buttonTextEl && node.dataset.originalText) {
                    try {
                      buttonTextEl.textContent = node.dataset.originalText
                    } catch (err) {
                      // ignore
                    }
                  }

                  // Remove the helper note if present
                  const noteEl = node.querySelector('.plan-limited-note')
                  if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl)
                  const comparisonText = node.querySelector('.comparison_text_pricing');
                  if (comparisonText) comparisonText.style.opacity = '';
                  // Restore any comparison original price visibility
                  node.querySelectorAll('.pricing_price-original.in-comparison-block').forEach(el => {
                    el.style.opacity = ''
                  })
                } catch (err) {
                  console.warn('Failed to restore CTA text or remove limited note', err)
                }
              }
            } catch (err) {
              console.warn('Failed to update CTA text for plan', def.key, err)
            }
            if (!hasAny) {
              node.classList.add('no-unit-prices')
            } else {
              node.classList.remove('no-unit-prices')
            }
          })
        } catch (err) {
          // Non-fatal — DOM may not include the selector in some contexts
          console.warn('Failed to toggle no-unit-prices class for', def.key, err)
        }
      })
    } catch (err) {
      console.error('Error computing prices in updatePriceState', err)
      state.starterFeePlan = null
      state.starterNoFeePlan = null
      state.proPlan = null
      state.ultimatePlan = null
      state.slimPlan = null
      state.starterMonthlyPrice = null
      state.starterNoFeeMonthlyPrice = null
      state.proMonthlyPrice = null
      state.ultimateMonthlyPrice = null
      state.slimMonthlyPrice = null
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