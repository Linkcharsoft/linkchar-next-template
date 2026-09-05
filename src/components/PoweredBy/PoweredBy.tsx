import './PoweredBy.sass'

const INFERENCIA_URL = 'https://inferencia.io/'

interface Props {
  className?: string
}

const PoweredBy = ({ className }: Props) => (
  <div className={['PoweredBy', className].filter(Boolean).join(' ')}>
    <p className='PoweredBy__Text'>
      Powered by{' '}
      <a
        href={INFERENCIA_URL}
        target='_blank'
        rel='noopener noreferrer'
        className='PoweredBy__Link'
      >
        Inferencia AI Solutions
      </a>
    </p>
  </div>
)

export default PoweredBy
