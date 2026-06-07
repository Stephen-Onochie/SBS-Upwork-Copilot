// Centralized Upwork DOM selectors.
// ALL content scripts must import from here — never hardcode selectors elsewhere.
// If Upwork changes their DOM, fix it in one place.

export const SELECTORS = {
  // Profile page
  profile: {
    title: '[data-test="freelancer-title"]',
    overview: '[data-test="overview-text"]',
    rate: '[data-test="freelancer-rate"]',
    skills: '[data-test="skill-badge"]',
    workHistoryItems: '[data-test="portfolio-item-card"]',
    employmentItems: '[data-test="employment-item"]',
    educationItems: '[data-test="education-item"]',
    portfolioItems: '[data-test="portfolio-item"]',
    // Fallback selectors
    titleFallback: '.freelancer-title, h2.name',
    overviewFallback: '.freelancer-overview p',
  },

  // Job post page
  jobPost: {
    title: '[data-test="job-title"], h1.job-title',
    description: '[data-test="description"] .description, .job-description',
    skills: '[data-test="attr-item"] span, .skills-list span',
    budgetFixed: '[data-test="job-type-label"]',
    budgetHourly: '[data-test="budget-amount"]',
    clientName: '[data-test="client-name"]',
    clientRating: '[data-test="feedback-score"]',
    clientHireRate: '[data-test="client-stats-hire-rate"]',
    clientTotalSpent: '[data-test="client-stats-total-spent"]',
    clientPaymentVerified: '[data-test="payment-verified"]',
    proposalCount: '[data-test="proposals-tier"]',
    postedAt: '[data-test="posted-on"] time',
  },

  // Apply / proposal page
  apply: {
    coverLetterTextarea: '[data-test="cover-letter-textarea"], textarea[placeholder*="cover letter"], textarea[name="coverLetter"]',
    submitButton: '[data-test="submit-proposal-button"], button[type="submit"]',
    connectsBase: '[data-test="connects-cost"]',
    connectsBoostInput: '[data-test="boost-bid-input"], input[name="boostBid"]',
    screeningQuestion: '[data-test="additional-questions"] .question-item, .screening-questions .question',
  },

  // Messages / room page
  messages: {
    clientName: '[data-test="room-member-name"], .room-recipient-name',
    clientCompany: '[data-test="room-member-company"]',
    jobTitle: '[data-test="room-job-title"]',
  },

  // Saved searches (find work page)
  savedSearches: {
    searchItems: '[data-test="saved-search-item"]',
    searchLabel: '[data-test="saved-search-name"]',
    searchLink: 'a[data-test="saved-search-link"]',
  },
}
