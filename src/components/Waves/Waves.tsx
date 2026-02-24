import './Waves.sass'

const Waves = () => {
  return (
    <div className="Waves">
      <svg
        className='Waves__SVG'
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
        <g className="Waves__Parallax">
          <use xlinkHref="#gentle-wave" x="48" y="9" fill="url(#grad-1)" opacity={1}/>
          <use xlinkHref="#gentle-wave" x="48" y="6" fill="url(#grad-2)" opacity={0.75}/>
          <use xlinkHref="#gentle-wave" x="48" y="3" fill="url(#grad-3)" opacity={0.5}/>
          <use xlinkHref="#gentle-wave" x="48" y="0" fill="url(#grad-4)" opacity={0.25}/>
        </g>
      </svg>
    </div>
  )
}

export default Waves