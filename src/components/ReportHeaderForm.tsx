import { useReport } from '@/state/reportContext';

export function ReportHeaderForm() {
  const { state, updateHeader } = useReport();

  return (
    <div className="hdr">
      <div>
        <label className="lbl" htmlFor="fProj">
          Project
        </label>
        <input
          id="fProj"
          value={state.proj}
          placeholder="CORA Merrick Park"
          onChange={(e) => updateHeader({ proj: e.target.value })}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="fDate">
          Visit date
        </label>
        <input
          id="fDate"
          type="date"
          value={state.date}
          onChange={(e) => updateHeader({ date: e.target.value })}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="fBy">
          Observed by
        </label>
        <input
          id="fBy"
          value={state.by}
          placeholder="Alfonso Orozco"
          onChange={(e) => updateHeader({ by: e.target.value })}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="fRef">
          Report no.
        </label>
        {/* Escribir aqui desactiva la autogeneracion a partir de la fecha. */}
        <input
          id="fRef"
          value={state.ref}
          placeholder="SVR-20260721-A"
          onChange={(e) => updateHeader({ ref: e.target.value })}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label className="lbl" htmlFor="fTo">
          Issued to
        </label>
        <input
          id="fTo"
          value={state.to}
          placeholder="Winmar Construction - Luis Alfonzo"
          onChange={(e) => updateHeader({ to: e.target.value })}
        />
      </div>
    </div>
  );
}
