import { Component } from 'react'
import { useStore } from '../state/store'

// If anything in the 3D world throws (a GPU driver bug, a failed asset), fall back to
// the text version instead of showing a blank page.
export default class WorldBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('3D world failed to start:', error)
    const store = useStore.getState()
    store.setLoadError(String(error?.message ?? error))
    store.setMode('quick')
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
