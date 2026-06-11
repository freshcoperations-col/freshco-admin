import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        alt?: string
        ar?: boolean
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'shadow-intensity'?: string
        'shadow-softness'?: string
        exposure?: string
        'tone-mapping'?: string
        'environment-image'?: string
        'skybox-image'?: string
        'camera-target'?: string
        'camera-orbit'?: string
        'min-camera-orbit'?: string
        'max-camera-orbit'?: string
        'field-of-view'?: string
      }
    }
  }
}

export {}
