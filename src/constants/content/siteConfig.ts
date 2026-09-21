import type { SiteConfigType } from '@/types/cms'

// Site-wide copy and contact data shipped with the build; the Storyblok `config` story overrides it field by field.
export const SITE_CONFIG_FALLBACK: SiteConfigType = {
  email: 'hello@example.com',
  phoneNumber: '+5491100000000',
  phoneLabel: '11 0000-0000',
  whatsappNumber: '5491100000000',
  instagramUrl: 'https://www.instagram.com/linkchar',
  linkedinUrl: 'https://www.linkedin.com/company/linkchar',
  addressLines: ['Street 123', 'City, Country'],
  footerDescription: 'Short description of the product or company.',
  footerLegal: 'All rights reserved.'
}
