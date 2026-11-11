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

// 최신 데이터를 사람이 읽는 말로 바꾼 신호 목록
function signals(data) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const mas = MA_KEYS.map((k) => last[k]);
  const bull = mas.every((v, i) => i === 0 || mas[i - 1] > v);
  const bear = mas.every((v, i) => i === 0 || mas[i - 1] < v);
  const pb = ((last.Close - last.BB_Lower) / (last.BB_Upper - last.BB_Lower)) * 100;
  const rsi = last.RSI14;
  return [
    {
      label: '이동평균 배열',
      value: bull ? '정배열' : bear ? '역배열' : '혼조',
      note: bull ? '단기선이 장기선 위, 상승 추세' : bear ? '단기선이 장기선 아래, 하락 추세' : '이동평균선 방향이 엇갈림',
      tone: bull ? 'up' : bear ? 'down' : '',
    },
    { label: 'RSI 14', value: rsi.toFixed(1), note: rsiState(rsi), tone: rsi >= 70 ? 'up' : rsi <= 30 ? 'down' : '' },
    {
      label: 'MACD',
      value: prev.Hist <= 0 && last.Hist > 0 ? '골든크로스' : prev.Hist >= 0 && last.Hist < 0 ? '데드크로스' : last.Hist > 0 ? '상승 모멘텀' : '하락 모멘텀',
      note: `시그널선과의 차이 ${won(last.Hist)}`,
      tone: tone(last.Hist),
    },
    {
      label: '볼린저 %B',
      value: Math.round(pb),
      note: pb > 100 ? '밴드 상단을 넘어섬' : pb < 0 ? '밴드 하단 아래로 내려감' : pb >= 50 ? '밴드 안, 중심선 위' : '밴드 안, 중심선 아래',
      tone: pb > 100 ? 'up' : pb < 0 ? 'down' : '',
    },
  ];
}

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
        시세 서버에 연결하지 못했습니다. FastAPI 서버가 실행 중인지 확인한 뒤 새로고침하세요.
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
  const tableData = data.slice(-tableRows).reverse();
  const chartProps = { rows, hover, onHover: setHover };

  return (
    <>
      <main>
        <header className="hero">
          <div className="quote">
            <h1>{res.name}<span className="code">{res.code} 코스피</span></h1>
            <p className="price">{won(last.Close)}<span className="unit">원</span></p>
            <p className={`delta ${tone(summary.change)}`}>
              {summary.change > 0 ? '▲' : summary.change < 0 ? '▼' : ''} {won(Math.abs(summary.change))}원
              <span>{pct(last.Change)}</span>
            </p>
            <dl className="ohlc">
              <div><dt>시가</dt><dd>{won(last.Open)}</dd></div>
              <div><dt>고가</dt><dd className="up">{won(last.High)}</dd></div>
              <div><dt>저가</dt><dd className="down">{won(last.Low)}</dd></div>
              <div><dt>거래량</dt><dd>{won(last.Volume)}</dd></div>
            </dl>
            <p className="asof">{fmtDate(res.updated)} 기준</p>
          </div>

          <section className="signals" aria-labelledby="signals-title">
            <h2 id="signals-title">지금의 신호</h2>
            <ul>
              {signals(data).map((s) => (
                <li key={s.label}>
                  <span className="sig-label">{s.label}</span>
                  <b className={s.tone}>{s.value}</b>
                  <span className="sig-note">{s.note}</span>
                </li>
              ))}
            </ul>
          </section>
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
            <h2>52주 범위 안에서의 위치</h2>
            <p className="fact-num">{Math.round(rangePos * 100)}<span className="unit">%</span></p>
            <div className="range-track" aria-hidden="true">
              <span className="range-fill" style={{ width: `${rangePos * 100}%` }} />
              <span className="range-mark" style={{ left: `${rangePos * 100}%` }} />
            </div>
            <div className="range-ends">
              <span>최저 {won(summary.low_52w)}</span>
              <span>최고 {won(summary.high_52w)}</span>
            </div>
          </div>
          <div>
            <h2>거래량, 20일 평균 대비</h2>
            <p className="fact-num">{volRatio.toFixed(2)}<span className="unit">배</span></p>
            <div className="range-track" aria-hidden="true">
              <span className="range-fill" style={{ width: `${Math.min(volRatio / 3, 1) * 100}%` }} />
            </div>
            <div className="range-ends"><span>0배</span><span>3배</span></div>
          </div>
          <div>
            <h2>20일 변동성</h2>
            <p className="fact-num">{summary.volatility_20}<span className="unit">%</span></p>
            <p className="fact-note">최근 20일 일간 수익률의 표준편차를 1년 기준으로 환산한 값입니다.</p>
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
        </section>

        <section className="daily">
          <h2>일별 시세</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>날짜</th><th>종가</th><th>전일 대비</th><th>등락률</th><th>시가</th><th>고가</th><th>저가</th><th>거래량</th></tr>
              </thead>
              <tbody>
                {tableData.map((r) => {
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

      <footer>
        <span>데이터 출처 FinanceDataReader</span>
        <span>투자 판단의 책임은 투자자 본인에게 있습니다.</span>
      </footer>
    </>
  );
}
export default App;
