'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'
import * as THREE from 'three'
import Lenis from 'lenis'
import Logo from '@/assets/images/logo.svg'

const MAX_TIME_VALUE = 10
const PRODUCT_NAME = 'Linkchar'


// Borrar el contenido de este componente al desarrollar la app
const HomePage = () => {
  const containerRef = useRef<any>(null)
  const scrollRef = useRef(null)
  const vertexRef = useRef<any>(null)
  const fragmentRef = useRef<any>(null)


  function oscilateTime(time) {
    const boundedTime = time % (2 * MAX_TIME_VALUE)
    const oscillatingTime = boundedTime > MAX_TIME_VALUE ? 2 * MAX_TIME_VALUE - boundedTime : boundedTime
    return oscillatingTime
  }


  // Lenis
  useEffect(() => {
    if(scrollRef.current) {
      const lenis = new Lenis({
        wrapper: scrollRef.current,
      })

      const raf = (time) => {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }

      requestAnimationFrame(raf)
    }
  }, [scrollRef])

  // Background
  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current && vertexRef.current && fragmentRef.current) {
      let requestId
      const windowHalfX = containerRef.current?.offsetWidth / 2
      const windowHalfY = containerRef.current?.offsetHeight / 2

      class World {
        private renderer: THREE.WebGLRenderer
        private container: HTMLElement
        private scene: THREE.Scene
        private width: number
        private height: number
        private aspectRatio: number
        private fieldOfView: number
        private camera: THREE.PerspectiveCamera
        private timer: number
        private mousePos: {x: number, y: number}
        private mouseX: number
        private mouseY: number
        private targetMousePos: {x: number, y: number}
        private material: THREE.RawShaderMaterial
        private planeGeometry: THREE.PlaneGeometry
        private mat: THREE.MeshBasicMaterial
        private plane: THREE.Mesh

        constructor(width, height) {
          this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: false
          })
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          // this.renderer.setPixelRatio(window.devicePixelRatio)

          this.renderer.setSize(width, height)
          this.container = containerRef.current
          this.scene = new THREE.Scene()
          this.width = width
          this.height = height
          this.aspectRatio = width / height
          this.fieldOfView = 50
          const nearPlane = .1
          const farPlane = 100
          this.camera = new THREE.PerspectiveCamera(this.fieldOfView, this.aspectRatio, nearPlane, farPlane)
          this.camera.position.z = 30
          this.camera.position.x = 0
          this.container.appendChild(this.renderer.domElement)
          this.timer = 0
          this.mousePos = {x: 0, y: 0}
          this.mouseX = 0
          this.mouseY = 0
          this.targetMousePos = {x: 0, y: 0}
          this.createPlane()
          this.render()
        }

        createPlane() {
          this.material = new THREE.RawShaderMaterial({
            vertexShader: vertexRef.current?.textContent,
            fragmentShader: fragmentRef.current?.textContent,
            uniforms: {
              iTime: {type: 'f', value: 0},
              uHue: {type: 'f', value: .5},
              uHueVariation: {type: 'f', value: 1},
              uGradient: {type: 'f', value: 1},
              uDensity: {type: 'f', value: 1},
              uDisplacement: {type: 'f', value: 1},
              uMousePosition: {type: 'v2', value: new THREE.Vector2(1.5, 3.5)},
              iResolution: {type: 'v2', value: new THREE.Vector2(containerRef.current?.offsetWidth, containerRef.current?.offsetHeight)},
              scroll: {type: 'f', value: 0},
            }
          })
          this.planeGeometry = new THREE.PlaneGeometry(2, 4, 1, 1)
          this.mat = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide})
          this.plane = new THREE.Mesh(this.planeGeometry, this.material)
          this.scene.add(this.plane)
          this.plane.position.z = 0
        }

        loop() {
          this.render()
          requestId = requestAnimationFrame(this.loop.bind(this))
        }

        render() {
          this.timer += 0.5
          this.plane.material.uniforms.iTime.value = oscilateTime(this.timer / 300)
          this.mousePos.x += (this.targetMousePos.x - this.mousePos.x) * .1
          this.mousePos.y += (this.targetMousePos.y - this.mousePos.y) * .1

          if (this.plane) {
            this.plane.material.uniforms.uMousePosition.value = new THREE.Vector2(this.mousePos.x, this.mousePos.y)
          }

          this.renderer.render(this.scene, this.camera)
        }

        // start render
        start() {
          this.loop()
        }

        // stop render
        stop() {
          window.cancelAnimationFrame(requestId)
          requestId = undefined
        }

        updateSize(w, h) {
          // Update camera
          this.camera.aspect = w / h
          this.camera.updateProjectionMatrix()
          // Update renderer
          this.renderer.setSize(w, h)
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          // this.renderer.setPixelRatio(0.3)
          this.plane.material.uniforms.iResolution.value = new THREE.Vector2(w, h)
        }


        mouseMove(mousePos) {
          this.targetMousePos.x = mousePos.px
          this.targetMousePos.y = mousePos.py
          this.mouseX = (mousePos.x - windowHalfX) * 0.01
          this.mouseY = (mousePos.y - windowHalfY) * 0.01
        }
      }

      const mousePos = {x: 0, y: 0, px: 0, py: 0}
      let world

      // let gui = new dat.GUI()

      const domIsReady = () => {
        world = new World(containerRef.current?.offsetWidth, containerRef.current?.offsetHeight)
        // console.log(world)
        window.addEventListener('resize', handleWindowResize, false)
        document.addEventListener('mousemove', handleMouseMove, false)
        handleWindowResize()
        world.loop()
      }

      const handleWindowResize = () => {
        world.updateSize(containerRef.current?.offsetWidth, containerRef.current?.offsetHeight)
      }

      const handleMouseMove = (e) => {
        mousePos.x = e.clientX
        mousePos.y = e.clientY
        mousePos.px = mousePos.x / containerRef.current?.offsetWidth
        mousePos.py = 1.0 - mousePos.y / containerRef.current?.offsetHeight
        world.mouseMove(mousePos)
      }

      domIsReady()
      window.addEventListener('resize', handleWindowResize)
    }
  }, [containerRef, vertexRef, fragmentRef])


  return (
    <>
      <main ref={containerRef} className="HomePage font-bold text-white">
        <Image
          src={Logo}
          alt={PRODUCT_NAME}
          title={PRODUCT_NAME}
          className="HomePage__Logo"
        />
        <h1 className='text-6xl font-extrabold'>{ PRODUCT_NAME }</h1>
        <h3 className='text-2xl'>Coming Soon</h3>
        <h4 className='font-light'>Powered by <a className='font-bold hover:text-pink-700' href="https://linkchar.com/" target="_blank" rel="noopener noreferrer">Linkchar</a></h4>

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
            `,
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
            `,
          }}
        />
      </main>
    </>
  )
}

export default HomePage