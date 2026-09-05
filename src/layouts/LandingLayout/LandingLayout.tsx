import PoweredBy from '@/components/PoweredBy/PoweredBy'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

// Shared shell for public marketing pages (no cookies → static). Add header/footer here.
const LandingLayout = ({ children }: Props) => (
  <>
    { children }
    <PoweredBy/>
  </>
)

export default LandingLayout
