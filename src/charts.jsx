import { useLayoutEffect, useRef, useState } from 'react';
import { MA_KEYS, won } from './format.js';

const AXIS = 68; // 오른쪽 가격축 폭
const volUnit = (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 1e4).toLocaleString('ko-KR')}만`);

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min, max, count = 4) {
  const raw = (max - min) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(+v.toFixed(6));
  return out;
}

// null 구간(이동평균 초기값)에서는 선을 끊는다
function linePath(rows, key, x, y) {
  return rows
    .map((r, i) => (r[key] == null ? '' : `${rows[i - 1]?.[key] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`))
    .join('');
}

// 가로축 공유 SVG 틀: 격자, 오른쪽 눈금, 십자선, 포인터 처리
function Plot({ n, height, min, max, ticks = [], fmt = won, hover, onHover, children }) {
  const [ref, w] = useWidth();
  const plotW = Math.max(0, w - AXIS);
  const step = plotW / n;
  const x = (i) => (i + 0.5) * step;
  const y = (v) => 8 + (1 - (v - min) / (max - min || 1)) * (height - 16);
  const pick = (e) => {
    const i = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / step);
    onHover(i >= 0 && i < n ? i : null);
  };
  return (
    <div ref={ref} className="plot">
      {w > 0 && (
        <svg width={w} height={height} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => onHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={0} x2={plotW} y1={y(t)} y2={y(t)} />
              <text className="tick" x={plotW + 8} y={y(t)} dy="0.35em">{fmt(t)}</text>
            </g>
          ))}
          {children({ x, y, step, plotW })}
          {hover != null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={0} y2={height} />}
        </svg>
      )}
    </div>
  );
}

export function PriceChart({ rows, show, hover, onHover }) {
  const keys = [...MA_KEYS.filter((k) => show[k]), ...(show.BB ? ['BB_Upper', 'BB_Lower'] : [])];
  let lo = Infinity, hi = -Infinity;
  for (const r of rows) for (const v of [r.Low, r.High, ...keys.map((k) => r[k])]) {
    if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const pad = (hi - lo) * 0.04;
  const last = rows[rows.length - 1];
  const lastUp = last.Change >= 0;

  return (
    <Plot n={rows.length} height={340} min={lo - pad} max={hi + pad} ticks={niceTicks(lo, hi, 5)} hover={hover} onHover={onHover}>
      {({ x, y, step, plotW }) => {
        // shortcut: 밴드는 null이 앞쪽에만 있다고 가정(초기 20일), 중간 결측이 생기면 구간별로 나눠야 함
        const band = rows.map((r, i) => [i, r]).filter(([, r]) => r.BB_Upper != null);
        const candles = step >= 3;
        const bw = Math.max(1, step * 0.62);
        return (
          <>
            {show.BB && band.length > 1 && (
              <>
                <path className="bb-fill" d={`M${band.map(([i, r]) => `${x(i)},${y(r.BB_Upper)}`).join('L')}L${band.reverse().map(([i, r]) => `${x(i)},${y(r.BB_Lower)}`).join('L')}Z`} />
                <path className="bb-edge" d={linePath(rows, 'BB_Upper', x, y)} />
                <path className="bb-edge" d={linePath(rows, 'BB_Lower', x, y)} />
              </>
            )}
            {candles
              ? rows.map((r, i) => {
                  const cls = r.Close >= r.Open ? 'up' : 'down';
                  const top = y(Math.max(r.Open, r.Close));
                  return (
                    <g key={r.Date} className={`candle ${cls}`} style={{ "--d": `${Math.min(i * 6, 900)}ms` }}>
                      <line x1={x(i)} x2={x(i)} y1={y(r.High)} y2={y(r.Low)} />
                      <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, y(Math.min(r.Open, r.Close)) - top)} />
                    </g>
                  );
                })
              : <path className="close-line draw" pathLength={1} d={linePath(rows, 'Close', x, y)} />}
            {MA_KEYS.filter((k) => show[k]).map((k) => (
              <path key={k} className="ma draw" pathLength={1} style={{ stroke: `var(--${k.toLowerCase()})` }} d={linePath(rows, k, x, y)} />
            ))}
            <line className={`last-line ${lastUp ? 'up' : 'down'}`} x1={0} x2={plotW} y1={y(last.Close)} y2={y(last.Close)} />
            <g className={`last-tag ${lastUp ? 'up' : 'down'}`}>
              <rect x={plotW + 2} y={y(last.Close) - 11} width={AXIS - 4} height={22} rx={3} />
              <text x={plotW + 8} y={y(last.Close)} dy="0.35em">{won(last.Close)}</text>
            </g>
            {hover != null && (
              <g className="hover-mark">
                <line x1={0} x2={plotW} y1={y(rows[hover].Close)} y2={y(rows[hover].Close)} />
                <circle cx={x(hover)} cy={y(rows[hover].Close)} r={4} />
                <rect x={plotW + 2} y={y(rows[hover].Close) - 11} width={AXIS - 4} height={22} rx={3} />
                <text x={plotW + 8} y={y(rows[hover].Close)} dy="0.35em">{won(rows[hover].Close)}</text>
              </g>
            )}
          </>
        );
      }}
    </Plot>
  );
}

export function VolumeChart({ rows, hover, onHover }) {
  const max = Math.max(...rows.map((r) => r.Volume));
  return (
    <Plot n={rows.length} height={72} min={0} max={max} ticks={niceTicks(0, max, 2).slice(1)} fmt={volUnit} hover={hover} onHover={onHover}>
      {({ x, y, step }) =>
        rows.map((r, i) => (
          <rect key={r.Date} className={`vol grow ${r.Close >= r.Open ? "up" : "down"}`} style={{ "--d": `${Math.min(i * 6, 900)}ms` }} x={x(i) - Math.max(1, step * 0.62) / 2} y={y(r.Volume)} width={Math.max(1, step * 0.62)} height={y(0) - y(r.Volume)} />
        ))
      }
    </Plot>
  );
}

export function RsiChart({ rows, hover, onHover }) {
  return (
    <Plot n={rows.length} height={110} min={0} max={100} ticks={[30, 70]} fmt={String} hover={hover} onHover={onHover}>
      {({ x, y, plotW }) => (
        <>
          <rect className="rsi-zone" x={0} y={y(70)} width={plotW} height={y(30) - y(70)} />
          <path className="ink-line draw" pathLength={1} d={linePath(rows, 'RSI14', x, y)} />
        </>
      )}
    </Plot>
  );
}

export function MacdChart({ rows, hover, onHover }) {
  const vals = rows.flatMap((r) => [r.MACD, r.Signal, r.Hist]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return (
    <Plot n={rows.length} height={130} min={lo} max={hi} ticks={niceTicks(lo, hi, 3)} hover={hover} onHover={onHover}>
      {({ x, y, step, plotW }) => (
        <>
          <line className="zero" x1={0} x2={plotW} y1={y(0)} y2={y(0)} />
          {rows.map((r, i) => (
            <rect key={r.Date} className={`vol ${r.Hist >= 0 ? 'up' : 'down'}`} x={x(i) - Math.max(1, step * 0.62) / 2} y={Math.min(y(0), y(r.Hist))} width={Math.max(1, step * 0.62)} height={Math.abs(y(r.Hist) - y(0))} />
          ))}
          <path className="ink-line draw" pathLength={1} d={linePath(rows, 'MACD', x, y)} />
          <path className="ma draw" pathLength={1} style={{ stroke: "var(--ma5)" }} d={linePath(rows, 'Signal', x, y)} />
        </>
      )}
    </Plot>
  );
}

// 날짜축: 짧은 기간은 날짜, 긴 기간은 월 경계
export function DateAxis({ rows }) {
  const [ref, w] = useWidth();
  const step = Math.max(0, w - AXIS) / rows.length;
  const labels = [];
  let lastX = -Infinity;
  rows.forEach((r, i) => {
    const [yy, mm, dd] = r.Date.split('-').map(Number);
    const prev = rows[i - 1]?.Date.split('-').map(Number);
    let text = null;
    if (rows.length <= 45) text = i % Math.ceil(rows.length / 6) === 0 ? `${mm}.${dd}` : null;
    else if (!prev || prev[1] !== mm) text = mm === 1 ? `${yy}년` : `${mm}월`;
    const px = (i + 0.5) * step;
    if (text && px - lastX > 52) { labels.push({ text, px }); lastX = px; }
  });
  return (
    <div ref={ref} className="plot">
      <svg width={w} height={24} aria-hidden="true">
        {labels.map((l) => <text key={l.px} className="tick" x={l.px} y={16} textAnchor="middle">{l.text}</text>)}
      </svg>
    </div>
  );
}
