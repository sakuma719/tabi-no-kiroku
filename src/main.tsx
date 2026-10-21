import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Never log potentially private travel data. */
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>データを読み込めませんでした</h1>
          <p>
            このブラウザでIndexedDBが利用できるか、端末の空き容量があるか確認してください。プライベートブラウズでは保存が制限される場合があります。
          </p>
          <p>保存済みデータを消去せずに、再読み込みしてお試しください。</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </main>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
