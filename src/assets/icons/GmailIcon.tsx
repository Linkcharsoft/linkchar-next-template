import { SVGProps, memo } from 'react'

const GmailIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={56}
    height={43}
    fill="none"
    viewBox="0 0 56 43"
    {...props}
  >
    <path
      fill="#4285F4"
      d="M12.688 42.134V20.728l-6.64-6.074-5.952-3.37v27.073a3.777 3.777 0 0 0 3.777 3.777h8.815Z"
    />
    <path
      fill="#34A853"
      d="M42.908 42.134h8.814a3.777 3.777 0 0 0 3.778-3.778V11.284l-6.743 3.86-5.85 5.584v21.406Z"
    />
    <path
      fill="#EA4335"
      d="m12.688 20.728-.904-8.364.903-8.005 15.11 11.333 15.11-11.333 1.011 7.573-1.01 8.796-15.11 11.333-15.11-11.333Z"
    />
    <path
      fill="#FBBC04"
      d="M42.908 4.359v16.369L55.5 11.284V6.247c0-4.671-5.333-7.334-9.066-4.533L42.908 4.36Z"
    />
    <path
      fill="#C5221F"
      d="m.096 11.284 5.79 4.344 6.802 5.1V4.358L9.162 1.715C5.422-1.087.096 1.576.096 6.247v5.037Z"
    />
  </svg>
)

export default memo(GmailIcon)
