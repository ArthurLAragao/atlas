import { BrowserRouter } from 'react-router-dom'
import { LazyMotion } from 'framer-motion'
import { AppRoutes } from './app/routes'
import { ThemeSync } from './app/ThemeSync'
import { DataProvider } from './components/DataProvider'

const loadMotionFeatures = () =>
  import('./app/motion-features').then((module) => module.default)

export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures}>
      <BrowserRouter>
        <ThemeSync />
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </BrowserRouter>
    </LazyMotion>
  )
}
