'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import Logo from '@/assets/images/logo.svg'

const NotFoundPage = () => {
  return (
    <div className='NotFoundPage'>
      <header></header>

      <div className="px-4 flex flex-col justify-center items-center gap-6 text-center">
        <Image
          src={Logo}
          alt='Logo'
          title='Logo'
          className="NotFoundPage__Logo"
          priority
        />
        <h1 className='text-bold-32 md:text-bold-56'>Página no encontrada</h1>
        <p className='text-regular-16 md:text-regular-18'>Lo sentimos, la página que buscas no existe o ha sido movida</p>
        <Link
          className='NotFoundPage__Link'
          href="/"
        >
          Volver al Inicio
        </Link>
      </div>

      <motion.div
        className="NotFoundPage__Waves-Container"
        initial={{
          willChange: 'opacity, transform',
          opacity: 0
        }}
        whileInView={{
          opacity: 1
        }}
        transition={{
          duration: 0.8,
          delay: 0.2
        }}
        viewport={{
          once: true,
          amount: 0.4
        }}
      >
        <svg
          className='NotFoundPage__Waves'
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
          shapeRendering="auto"
        >
          <defs>
            <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />

            <linearGradient id="grad-1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8348F4" />
              <stop offset="30%" stopColor="#000" />
            </linearGradient>

            <linearGradient id="grad-2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#53008f" />
              <stop offset="30%" stopColor="#000" />
            </linearGradient>

            <linearGradient id="grad-3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FE00FE" />
              <stop offset="30%" stopColor="#000" />
            </linearGradient>

            <linearGradient id="grad-4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#880088" />
              <stop offset="30%" stopColor="#000" />
            </linearGradient>
          </defs>
          <g className="NotFoundPage__Waves-Parallax">
            <use xlinkHref="#gentle-wave" x="48" y="9" fill="url(#grad-1)" opacity={1}/>
            <use xlinkHref="#gentle-wave" x="48" y="6" fill="url(#grad-2)" opacity={0.75}/>
            <use xlinkHref="#gentle-wave" x="48" y="3" fill="url(#grad-3)" opacity={0.5}/>
            <use xlinkHref="#gentle-wave" x="48" y="0" fill="url(#grad-4)" opacity={0.25}/>
          </g>
        </svg>
      </motion.div>
    </div>
  )
}

export default NotFoundPage