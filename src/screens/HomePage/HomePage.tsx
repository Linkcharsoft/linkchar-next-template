'use client'
import './HomePage.sass'
import Image from 'next/image'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import Logo from '@/assets/images/logo.svg'

const MAX_TIME_VALUE = 10
const PRODUCT_NAME = 'Linkchar'


// Delete the contents of this component when developing the app and run this command:
// pnpm remove three @types/three
const HomePage = () => {
  const containerRef = useRef<HTMLElement>(null)
  const vertexRef = useRef<HTMLScriptElement>(null)
  const fragmentRef = useRef<HTMLScriptElement>(null)


  function oscilateTime (time: number) {
    const boundedTime = time % (2 * MAX_TIME_VALUE)
    const oscillatingTime = boundedTime > MAX_TIME_VALUE ? 2 * MAX_TIME_VALUE - boundedTime : boundedTime
    return oscillatingTime
  }


  // Background
  useEffect(() => {
    if (!containerRef.current || !vertexRef.current || !fragmentRef.current) return

    let requestId: number | undefined
    const container = containerRef.current

    class World {
      private renderer: THREE.WebGLRenderer
      private scene: THREE.Scene
      private camera: THREE.PerspectiveCamera
      private timer: number
      private mousePos: { x: number, y: number }
      private targetMousePos: { x: number, y: number }
      private material!: THREE.RawShaderMaterial
      private plane!: THREE.Mesh

      constructor (width: number, height: number) {
        this.renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false
        })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(width, height)
        container.appendChild(this.renderer.domElement)
        this.scene = new THREE.Scene()
        const fieldOfView = 50
        const nearPlane = .1
        const farPlane = 100
        this.camera = new THREE.PerspectiveCamera(fieldOfView, width / height, nearPlane, farPlane)
        this.camera.position.z = 30
        this.camera.position.x = 0
        this.timer = 0
        this.mousePos = { x: 0, y: 0 }
        this.targetMousePos = { x: 0, y: 0 }
        this.createPlane()
        this.render()
      }

      createPlane () {
        this.material = new THREE.RawShaderMaterial({
          vertexShader: vertexRef.current?.textContent,
          fragmentShader: fragmentRef.current?.textContent,
          uniforms: {
            iTime: { value: 0 },
            uHue: { value: .5 },
            uHueVariation: { value: 1 },
            uGradient: { value: 1 },
            uDensity: { value: 1 },
            uDisplacement: { value: 1 },
            uMousePosition: { value: new THREE.Vector2(1.5, 3.5) },
            iResolution: { value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
            scroll: { value: 0 }
          }
        })
        const planeGeometry = new THREE.PlaneGeometry(2, 4, 1, 1)
        this.plane = new THREE.Mesh(planeGeometry, this.material)
        this.scene.add(this.plane)
        this.plane.position.z = 0
      }

      loop () {
        this.render()
        requestId = requestAnimationFrame(this.loop.bind(this))
      }

      render () {
        this.timer += 0.5
        this.material.uniforms.iTime.value = oscilateTime(this.timer / 300)
        this.mousePos.x += (this.targetMousePos.x - this.mousePos.x) * .1
        this.mousePos.y += (this.targetMousePos.y - this.mousePos.y) * .1

        if (this.plane) {
          this.material.uniforms.uMousePosition.value = new THREE.Vector2(this.mousePos.x, this.mousePos.y)
        }

        this.renderer.render(this.scene, this.camera)
      }

      stop () {
        if (requestId) {
          window.cancelAnimationFrame(requestId)
          requestId = undefined
        }
      }

      dispose () {
        this.stop()
        this.renderer.dispose()
        this.renderer.domElement.remove()
      }

      updateSize (w: number, h: number) {
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.material.uniforms.iResolution.value = new THREE.Vector2(w, h)
      }

      mouseMove (mousePos: { x: number, y: number, px: number, py: number }) {
        this.targetMousePos.x = mousePos.px
        this.targetMousePos.y = mousePos.py
      }
    }

    const mousePos = { x: 0, y: 0, px: 0, py: 0 }
    const world = new World(container.offsetWidth, container.offsetHeight)

    const handleWindowResize = () => {
      world.updateSize(container.offsetWidth, container.offsetHeight)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.x = e.clientX
      mousePos.y = e.clientY
      mousePos.px = mousePos.x / container.offsetWidth
      mousePos.py = 1.0 - mousePos.y / container.offsetHeight
      world.mouseMove(mousePos)
    }

    window.addEventListener('resize', handleWindowResize)
    document.addEventListener('mousemove', handleMouseMove)
    handleWindowResize()
    world.loop()

    return () => {
      world.dispose()
      window.removeEventListener('resize', handleWindowResize)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])


  return (
    <main id="main" ref={containerRef} className="HomePage text-bold-16 text-white">
      <Image
        src={Logo}
        alt={PRODUCT_NAME}
        title={PRODUCT_NAME}
        className="HomePage__Logo"
        priority
        fetchPriority="high"
      />
      <h1 className='text-extrabold-64'>{ PRODUCT_NAME }</h1>
      <h2 className='text-24'>Coming Soon</h2>
      <p className='text-light-16'>Powered by <a className='text-bold-16 hover:text-pink-700' href="https://inferencia.io/" target="_blank" rel="noopener noreferrer">Inferencia</a></p>

      <script
        ref={fragmentRef}
        type="x-shader/x-fragment"
        id="fragmentShader"
        dangerouslySetInnerHTML={{
          __html: `
          precision highp float;

          uniform float iTime;
          uniform float scroll;
          uniform vec2 uMousePosition;

          varying vec2 vUv;

          #define t iTime

          mat2 m(float a){float c=cos(a), s=sin(a);return mat2(c,-s,s,c);}

          float map(vec3 p){
                p.xz*= m(t*.1);p.xy*= m(t*0.3);
                vec3 q = p*2.+t;
                return length(p+vec3(t*0.05))*sin(length(p) - (scroll * 0.005)) + sin(q.x+cos(q.z+sin(q.y)))*(0.1) - (uMousePosition.x * 0.1) + 1.0  ;
          }

          void mainImage(out vec4 fragColor, in vec2 fragCoord) {
              vec2 p = -0.7 + 2.0 * vUv;
              vec3 cl = vec3(2.0);
              float d = 1.5;
              for(int i = 0; i <= 5; i++) {
                  vec3 p3 = vec3(3.0, 3.0, 1.0) + normalize(vec3(p, -1.0)) * d;
                  float rz = map(p3);
                  float f = clamp((rz - map(p3 + 0.1)) * 0.6, -0.1, 5.0);
                  vec3 l = vec3(0.5, 0.0, 0.4) + vec3(9.0, 0.0, 9.0) * f;
                  cl = cl * l + smoothstep(6.0, 1000000.0, rz) * 0.7 * l;
                  d += min(rz, 0.1);
              }
              fragColor = vec4(cl, 1.0);
          }

          void main() {
                mainImage(gl_FragColor, gl_FragCoord.xy);
          }
          `
        }}
      />
      <script
        ref={vertexRef}
        type="x-shader/x-vertex"
        id="vertexShader"
        dangerouslySetInnerHTML={{
          __html: `
          attribute vec3 position;
          attribute vec2 uv;

          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec4 pos = vec4(position, 1.0);
            gl_Position = pos;
          }
          `
        }}
      />
    </main>
  )
}

export default HomePage
