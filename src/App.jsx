import { useEffect, useState } from 'react';
import './App.css';

const COLS = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Change', 'MA5', 'MA20', 'MA60', 'MA120', 'RSI14', 'MACD', 'Signal', 'Hist', 'BB_Upper', 'BB_Lower'];
const fmt = (v) => (v == null ? '-' : typeof v === 'number' ? v.toLocaleString() : v);

// Minimal SVG line chart; null values break the line (e.g. MA warm-up period)
function LineChart({ rows, series, height = 220 }) {
  const W = 1000, H = height, P = 4;
  const vals = rows.flatMap((r) => series.map((s) => r[s.key])).filter((v) => v != null);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i) => P + (i / (rows.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const path = (key) =>
    rows.map((r, i) => (r[key] == null ? '' : `${i && rows[i - 1][key] != null ? 'L' : 'M'}${x(i)},${y(r[key])}`)).join('');
  return (
    <div>
      <div className="legend">
        {series.map((s) => <span key={s.key} style={{ color: s.color }}>● {s.key}</span>)}
        <span className="range">{fmt(min)} ~ {fmt(max)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
        {series.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" style={{ stroke: s.color }} strokeWidth={s.width ?? 1.5} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

function App() {
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/samsung')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setRes)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="msg">데이터를 불러오지 못했습니다: {error}</p>;
  if (!res) return <p className="msg">불러오는 중…</p>;

  const { summary, data } = res;
  const last = data[data.length - 1];
  const up = last.Change >= 0;

  return (
    <main>
      <header>
        <h1>{res.name} <small>{res.code}</small></h1>
        <p className="price">
          {fmt(last.Close)}원{' '}
          <span className={up ? 'up' : 'down'}>
            {up ? '▲' : '▼'} {fmt(summary.change)} ({last.Change}%)
          </span>
        </p>
        <p className="muted">기준일 {res.updated}</p>
      </header>

      <section className="cards">
        <div><span>52주 최고</span><b>{fmt(summary.high_52w)}</b></div>
        <div><span>52주 최저</span><b>{fmt(summary.low_52w)}</b></div>
        <div><span>20일 평균 거래량</span><b>{fmt(summary.avg_volume_20)}</b></div>
        <div><span>20일 변동성</span><b>{fmt(summary.volatility_20)}</b></div>
        <div><span>RSI(14)</span><b>{fmt(last.RSI14)}</b></div>
      </section>

      <h2>주가 · 이동평균 · 볼린저밴드</h2>
      <LineChart
        rows={data}
        height={320}
        series={[
          { key: 'BB_Upper', color: '#bbb', width: 1 },
          { key: 'BB_Lower', color: '#bbb', width: 1 },
          { key: 'Close', color: 'var(--text-h)', width: 2 },
          { key: 'MA5', color: '#e67e22' },
          { key: 'MA20', color: '#e74c3c' },
          { key: 'MA60', color: '#27ae60' },
          { key: 'MA120', color: '#2980b9' },
        ]}
      />

      <h2>RSI(14)</h2>
      <LineChart rows={data} height={120} series={[{ key: 'RSI14', color: '#8e44ad' }]} />

      <h2>MACD</h2>
      <LineChart rows={data} height={140} series={[{ key: 'MACD', color: '#2980b9' }, { key: 'Signal', color: '#e67e22' }]} />

      <h2>최근 30일 데이터</h2>
      <div className="table-wrap">
        <table>
          <thead><tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {data.slice(-30).reverse().map((r) => (
              <tr key={r.Date}>
                {COLS.map((c) => (
                  <td key={c} className={c === 'Change' ? (r.Change >= 0 ? 'up' : 'down') : ''}>{fmt(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
export default App;
