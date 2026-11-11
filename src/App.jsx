import { useEffect, useState } from 'react';
import { DateAxis, MacdChart, PriceChart, RsiChart, VolumeChart } from './charts.jsx';
import { MA_KEYS, won } from './format.js';
import './App.css';

const PERIODS = [['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 250], ['전체', Infinity]];
const LINES = [['MA5', '5일선'], ['MA20', '20일선'], ['MA60', '60일선'], ['MA120', '120일선'], ['BB', '볼린저밴드']];
const DAYS = '일월화수목금토';

const fmtDate = (s) => `${s.replaceAll('-', '.')} (${DAYS[new Date(`${s}T00:00`).getDay()]})`;
const pct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
const rsiState = (v) => (v == null ? '' : v >= 70 ? '과매수 구간' : v <= 30 ? '과매도 구간' : '중립');

function App() {
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(126);
  const [show, setShow] = useState({ MA5: true, MA20: true, MA60: true, MA120: true, BB: false });
  const [hover, setHover] = useState(null);
  const [tableRows, setTableRows] = useState(20);

  useEffect(() => {
    fetch('/samsung')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`응답 코드 ${r.status}`))))
      .then(setRes)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <p className="state">
        시세 서버(localhost:8000)에 연결하지 못했습니다. FastAPI 서버가 실행 중인지 확인한 뒤 새로고침하세요.
        <small>{error}</small>
      </p>
    );
  }
  if (!res) return <p className="state">시세를 불러오고 있습니다…</p>;

  const { summary, data } = res;
  const last = data[data.length - 1];
  const rows = data.slice(-period);
  const cur = rows[hover] ?? last;
  const rangePos = (last.Close - summary.low_52w) / (summary.high_52w - summary.low_52w);
  const volRatio = last.Volume / summary.avg_volume_20;
  const chartProps = { rows, hover, onHover: setHover };

  return (
    <main>
      <header className="top">
        <div>
          <h1>{res.name}<span className="code">{res.code}</span></h1>
          <p className="price">{won(last.Close)}<span className="unit">원</span></p>
          <p className={`delta ${tone(summary.change)}`}>
            {summary.change > 0 ? '▲' : summary.change < 0 ? '▼' : ''} {won(Math.abs(summary.change))}원 ({pct(last.Change)})
            <span className="asof">{fmtDate(res.updated)} 기준</span>
          </p>
        </div>

        <div className="range">
          <h2>52주 가격 범위</h2>
          <div className="range-track" role="img" aria-label={`52주 범위 중 ${Math.round(rangePos * 100)}% 위치`}>
            <span className="range-mark" style={{ left: `${rangePos * 100}%` }} />
          </div>
          <div className="range-ends">
            <span>최저 <b>{won(summary.low_52w)}</b></span>
            <span>최고 <b>{won(summary.high_52w)}</b></span>
          </div>
          <p className="range-note">
            최고가보다 <b className="down">{pct((last.Close / summary.high_52w - 1) * 100)}</b>, 최저가보다{' '}
            <b className="up">{pct((last.Close / summary.low_52w - 1) * 100)}</b>
          </p>
        </div>
      </header>

      <section className="board" aria-label="차트">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="기간">
            {PERIODS.map(([label, n]) => (
              <button key={label} aria-pressed={period === n} onClick={() => { setPeriod(n); setHover(null); }}>{label}</button>
            ))}
          </div>
          <div className="toggles" role="group" aria-label="보조선 표시">
            {LINES.map(([k, label]) => (
              <button key={k} aria-pressed={show[k]} style={{ '--c': `var(--${k.toLowerCase()})` }} onClick={() => setShow({ ...show, [k]: !show[k] })}>
                <i aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </div>

        <dl className="readout" aria-live="polite">
          <div className="readout-date"><dt className="sr">날짜</dt><dd>{fmtDate(cur.Date)}</dd></div>
          <div><dt>시가</dt><dd>{won(cur.Open)}</dd></div>
          <div><dt>고가</dt><dd className="up">{won(cur.High)}</dd></div>
          <div><dt>저가</dt><dd className="down">{won(cur.Low)}</dd></div>
          <div><dt>종가</dt><dd><b>{won(cur.Close)}</b> <span className={tone(cur.Change)}>{pct(cur.Change)}</span></dd></div>
          {MA_KEYS.filter((k) => show[k]).map((k) => (
            <div key={k} className="readout-ma"><dt style={{ color: `var(--${k.toLowerCase()})` }}>{k.slice(2)}일</dt><dd>{won(cur[k])}</dd></div>
          ))}
        </dl>

        <PriceChart {...chartProps} show={show} />

        <div className="pane-head"><h2>거래량</h2><span>{won(cur.Volume)}주</span></div>
        <VolumeChart {...chartProps} />

        <div className="pane-head">
          <h2>RSI 14</h2>
          <span>{cur.RSI14 ?? '–'}</span>
          <em>{rsiState(cur.RSI14)}</em>
        </div>
        <RsiChart {...chartProps} />

        <div className="pane-head">
          <h2>MACD</h2>
          <span><i className="key ink" />MACD {won(cur.MACD)}</span>
          <span><i className="key sig" />시그널 {won(cur.Signal)}</span>
          <em>{cur.MACD >= cur.Signal ? '시그널선 위' : '시그널선 아래'}</em>
        </div>
        <MacdChart {...chartProps} />
        <DateAxis rows={rows} />
      </section>

      <section className="facts">
        <div>
          <h2>오늘 거래량</h2>
          <p className="fact-num">{won(last.Volume)}<span className="unit">주</span></p>
          <div className="meter"><span style={{ width: `${Math.min(volRatio, 1) * 100}%` }} /></div>
          <p className="fact-note">20일 평균 {won(summary.avg_volume_20)}주의 {Math.round(volRatio * 100)}%</p>
        </div>
        <div>
          <h2>이동평균선과의 거리</h2>
          <ul className="ma-list">
            {MA_KEYS.map((k) => {
              const d = (last.Close / last[k] - 1) * 100;
              return (
                <li key={k}>
                  <span><i style={{ background: `var(--${k.toLowerCase()})` }} />{k.slice(2)}일선</span>
                  <span className="muted">{won(last[k])}</span>
                  <b className={tone(d)}>{pct(d)}</b>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h2>20일 변동성</h2>
          <p className="fact-num">{summary.volatility_20}</p>
          <p className="fact-note">최근 20거래일 등락폭을 기준으로 한 값입니다. 클수록 가격이 크게 움직였다는 뜻입니다.</p>
        </div>
      </section>

      <section className="daily">
        <h2>일별 시세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>날짜</th><th>종가</th><th>전일 대비</th><th>등락률</th><th>시가</th><th>고가</th><th>저가</th><th>거래량</th></tr>
            </thead>
            <tbody>
              {data.slice(-tableRows).reverse().map((r) => {
                const diff = r.Close - (data[data.indexOf(r) - 1]?.Close ?? r.Close);
                return (
                  <tr key={r.Date} className={r.Date === cur.Date ? 'is-current' : ''}>
                    <td>{fmtDate(r.Date)}</td>
                    <td><b>{won(r.Close)}</b></td>
                    <td className={tone(diff)}>{diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {won(Math.abs(diff))}</td>
                    <td className={tone(r.Change)}>{pct(r.Change)}</td>
                    <td>{won(r.Open)}</td>
                    <td>{won(r.High)}</td>
                    <td>{won(r.Low)}</td>
                    <td>{won(r.Volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableRows < data.length && (
          <button className="more" onClick={() => setTableRows(tableRows + 20)}>20일 더 보기</button>
        )}
      </section>
    </main>
  );
}
export default App;
