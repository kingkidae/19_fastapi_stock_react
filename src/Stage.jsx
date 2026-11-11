import { useEffect, useRef } from 'react';

// three.js는 별도 청크로 늦게 불러와 첫 화면을 막지 않는다
export default function Stage({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    let dispose;
    let cancelled = false;
    import('./stage3d.js')
      .then(({ mountStage }) => {
        if (!cancelled) dispose = mountStage(ref.current, data);
      })
      .catch(() => {}); // WebGL을 못 쓰는 환경이면 배경 없이 그대로 둔다
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [data]);
  return (
    <div className="stage" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
