import { BrowserRouter, HashRouter } from 'react-router-dom'
import { LazyMotion } from 'framer-motion'
import { AppRoutes } from './app/routes'
import { ThemeSync } from './app/ThemeSync'
import { DataProvider } from './components/DataProvider'

const loadMotionFeatures = () =>
  import('./app/motion-features').then((module) => module.default)

const Router = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter

export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures}>
      <Router>
        <ThemeSync />
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </Router>
    </LazyMotion>
  )
}
